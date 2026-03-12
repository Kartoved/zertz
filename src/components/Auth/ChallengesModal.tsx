import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getChallenges, cancelChallenge, acceptChallenge, declineChallenge, Challenge } from '../../db/authApi';
import { getPendingRooms, deleteRoom, PendingRoom } from '../../db/roomsApi';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';

const BOARD_LABELS: Record<number, string> = {
  37: '37',
  48: '48',
  61: '61',
};

interface ChallengesModalProps {
  onClose: () => void;
}

export default function ChallengesModal({ onClose }: ChallengesModalProps) {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const { user } = useAuthStore();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [pendingRooms, setPendingRooms] = useState<PendingRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [toast, setToast] = useState('');

  useEffect(() => {
    loadChallenges();
  }, []);

  const loadChallenges = async () => {
    setIsLoading(true);
    try {
      const [challengeData, roomData] = await Promise.all([
        getChallenges(),
        getPendingRooms(),
      ]);
      setChallenges(challengeData);
      setPendingRooms(roomData);
    } catch {
      // ignore
    }
    setIsLoading(false);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const incoming = challenges.filter(c => c.toUserId === user?.id);
  const outgoing = challenges.filter(c => c.fromUserId === user?.id);

  const handleAccept = async (challenge: Challenge) => {
    try {
      const result = await acceptChallenge(challenge.id);
      onClose();
      navigate(`/room/${result.roomId}`);
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleDecline = async (challenge: Challenge) => {
    try {
      await declineChallenge(challenge.id);
      setChallenges(prev => prev.filter(c => c.id !== challenge.id));
      showToast(t.challengeDeclined);
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleCancel = async (challenge: Challenge) => {
    try {
      await cancelChallenge(challenge.id);
      setChallenges(prev => prev.filter(c => c.id !== challenge.id));
      showToast(t.challengeCanceled);
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleDeleteRoom = async (roomId: number) => {
    try {
      await deleteRoom(roomId);
      setPendingRooms(prev => prev.filter(r => r.id !== roomId));
      showToast(t.challengeCanceled);
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleCopyLink = (roomId: number) => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`);
    showToast(t.copied);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  };

  const formatTimeControl = (room: PendingRoom) => {
    if (room.timeControlBaseMs && room.timeControlIncrementMs !== null) {
      const mins = Math.round(room.timeControlBaseMs / 60000);
      const inc = Math.round((room.timeControlIncrementMs || 0) / 1000);
      return `${mins}+${inc}`;
    }
    return '∞';
  };

  const outgoingCount = outgoing.length + pendingRooms.length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[70vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b dark:border-gray-700">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t.challenges}</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">✕</button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            <button
              onClick={() => setTab('incoming')}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === 'incoming' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {t.incoming} {incoming.length > 0 && `(${incoming.length})`}
            </button>
            <button
              onClick={() => setTab('outgoing')}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === 'outgoing' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {t.outgoing} {outgoingCount > 0 && `(${outgoingCount})`}
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">{t.loading}</div>
          ) : tab === 'incoming' ? (
            incoming.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                {t.noIncoming}
              </div>
            ) : (
              <div className="divide-y dark:divide-gray-700">
                {incoming.map(c => (
                  <div key={c.id} className="p-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white truncate">
                        {c.fromCountry} {c.fromUsername} ({c.fromRating})
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-2">
                        <span>{t.boardLabel}: {BOARD_LABELS[c.boardSize]}</span>
                        {c.rated && <span className="text-purple-500 font-medium">{t.rated}</span>}
                        <span>{formatTime(c.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleAccept(c)}
                        className="px-3 py-1.5 text-sm bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                      >
                        {t.accepted}
                      </button>
                      <button
                        onClick={() => handleDecline(c)}
                        className="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                      >
                        {t.decline}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            // Outgoing tab: challenges + pending invite rooms
            outgoing.length === 0 && pendingRooms.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                {t.noOutgoing}
              </div>
            ) : (
              <div className="divide-y dark:divide-gray-700">
                {/* Direct challenges */}
                {outgoing.map(c => (
                  <div key={`ch-${c.id}`} className="p-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white truncate">
                        {c.toCountry} {c.toUsername} ({c.toRating})
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-2">
                        <span>{t.boardLabel}: {BOARD_LABELS[c.boardSize]}</span>
                        {c.rated && <span className="text-purple-500 font-medium">{t.rated}</span>}
                        <span>{formatTime(c.createdAt)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleCancel(c)}
                      className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-red-100 hover:text-red-600 
                        text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                    >
                      {t.cancel}
                    </button>
                  </div>
                ))}

                {/* Pending invite rooms (play by link) */}
                {pendingRooms.map(room => (
                  <div key={`room-${room.id}`} className="p-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white truncate flex items-center gap-2">
                        <span>🔗 {t.playByLink}</span>
                        <span className="text-xs text-gray-400">#{room.id}</span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-2 flex-wrap">
                        <span>{t.boardLabel}: {BOARD_LABELS[room.boardSize]}</span>
                        <span>{formatTimeControl(room)}</span>
                        {room.rated && <span className="text-purple-500 font-medium">{t.rated}</span>}
                        <span>{formatTime(room.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleCopyLink(room.id)}
                        className="px-2.5 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600
                          text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                        title={t.copyLink}
                      >
                        📋
                      </button>
                      <button
                        onClick={() => handleDeleteRoom(room.id)}
                        className="px-2.5 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-red-100 hover:text-red-600 
                          text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                        title={t.cancel}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm text-center">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
