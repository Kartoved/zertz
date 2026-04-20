import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLobbyStore } from '../../store/lobbyStore';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import { LobbySlot } from '../../db/lobbyApi';
import { FISCHER_PRESETS, TIME_CONTROLS } from '../Layout/MainMenu';

interface LobbyScreenProps {
  onClose: () => void;
}

const BOARD_SIZES = [37, 48, 61] as const;

function formatCountdown(expiresAt: number, now: number): string {
  const ms = Math.max(0, expiresAt - now);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTimeControl(_timeControlId: string, baseMs: number | null, incMs: number | null): string {
  if (!baseMs) return '∞';
  const mins = Math.round(baseMs / 60000);
  if (incMs === -1) return `${mins}d`;
  const inc = Math.round((incMs || 0) / 1000);
  return `${mins}+${inc}`;
}

export default function LobbyScreen({ onClose }: LobbyScreenProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuthStore();
  const { slots, isLoading, error, createSlot, removeMySlot, joinSlot, startPolling, stopPolling } = useLobbyStore();

  const [showCreate, setShowCreate] = useState(false);
  const [boardSize, setBoardSize] = useState<37 | 48 | 61>(37);
  const [timeControlId, setTimeControlId] = useState('rapid');
  const [rated, setRated] = useState(true);
  const [actionError, setActionError] = useState('');
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  // Countdown ticker
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const mySlot = user ? slots.find(s => s.userId === user.id) ?? null : null;
  const otherSlots = user ? slots.filter(s => s.userId !== user.id && s.status === 'open') : slots.filter(s => s.status === 'open');

  // If creator's slot has been joined → navigate to room
  useEffect(() => {
    if (mySlot?.status === 'joined' && mySlot.roomId) {
      onClose();
      navigate(`/room/${mySlot.roomId}`);
    }
  }, [mySlot, onClose, navigate]);

  const handleCreate = useCallback(async () => {
    setActionError('');
    const tc = FISCHER_PRESETS.find(p => p.id === timeControlId);
    try {
      await createSlot({
        boardSize,
        timeControlId,
        timeControlBaseMs: tc ? tc.baseMs : null,
        timeControlIncrementMs: tc ? tc.incrementMs : null,
        rated,
      });
      setShowCreate(false);
    } catch (err: any) {
      setActionError(err.message);
    }
  }, [boardSize, timeControlId, rated, createSlot]);

  const handleJoin = useCallback(async (slot: LobbySlot) => {
    setActionError('');
    setJoiningId(slot.id);
    try {
      const roomId = await joinSlot(slot.id);
      onClose();
      navigate(`/room/${roomId}`);
    } catch (err: any) {
      setActionError(err.message);
      setJoiningId(null);
    }
  }, [joinSlot, onClose, navigate]);

  const handleCancel = useCallback(async () => {
    setActionError('');
    await removeMySlot();
    setShowCreate(false);
  }, [removeMySlot]);

  const boardLabel: Record<number, string> = { 37: '37', 48: '48', 61: '61' };
  const tcIcon = (id: string) => TIME_CONTROLS.find(c => c.id === id)?.icon ?? '?';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/50 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t.lobby}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">✕</button>
        </div>

        {/* My slot banner */}
        {mySlot && mySlot.status === 'open' && (
          <div className="mx-4 mt-4 px-4 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{t.lobbyWaiting}</p>
                <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">
                  {boardLabel[mySlot.boardSize]} · {tcIcon(mySlot.timeControlId)} {formatTimeControl(mySlot.timeControlId, mySlot.timeControlBaseMs, mySlot.timeControlIncrementMs)}
                  {' · '}{mySlot.rated ? t.lobbyRated : t.lobbyUnrated}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs font-mono text-indigo-500 dark:text-indigo-400">{formatCountdown(mySlot.expiresAt, now)}</span>
                <button
                  onClick={handleCancel}
                  disabled={isLoading}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60 font-medium transition-colors"
                >
                  {t.lobbyCancel}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create form */}
        {!mySlot && user && (
          <div className="px-4 mt-4">
            {!showCreate ? (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors"
              >
                + {t.lobbyCreate}
              </button>
            ) : (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                {/* Board size */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">{t.selectBoard}</p>
                  <div className="flex gap-2">
                    {BOARD_SIZES.map(bs => (
                      <button
                        key={bs}
                        onClick={() => setBoardSize(bs)}
                        className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition-colors
                          ${boardSize === bs
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-indigo-400'}`}
                      >
                        {bs}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time control */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">{t.timeControl}</p>
                  <div className="flex gap-2">
                    {TIME_CONTROLS.map(tc => (
                      <button
                        key={tc.id}
                        onClick={() => setTimeControlId(tc.id)}
                        className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition-colors
                          ${timeControlId === tc.id
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-indigo-400'}`}
                      >
                        {tc.icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rated toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{t.ratedGame}</span>
                  <button
                    onClick={() => setRated(r => !r)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${rated ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${rated ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setShowCreate(false)}
                    className="flex-1 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={isLoading}
                    className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                  >
                    {isLoading ? '...' : t.lobbyCreate}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!user && (
          <p className="mx-4 mt-4 text-center text-sm text-gray-500 dark:text-gray-400">{t.loginToPlay}</p>
        )}

        {/* Error */}
        {(actionError || error) && (
          <p className="mx-4 mt-2 text-sm text-red-500 text-center">{actionError || error}</p>
        )}

        {/* Slot list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 mt-2">
          {isLoading && slots.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">...</p>
          ) : otherSlots.length === 0 ? (
            <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-8">{t.lobbyEmpty}</p>
          ) : (
            otherSlots.map(slot => (
              <div key={slot.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700">
                {/* Country + name + rating */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base leading-none">{slot.country}</span>
                    <span className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate">{slot.username}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-0.5">({slot.rating})</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 font-mono">{slot.boardSize}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {tcIcon(slot.timeControlId)} {formatTimeControl(slot.timeControlId, slot.timeControlBaseMs, slot.timeControlIncrementMs)}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${slot.rated ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'}`}>
                      {slot.rated ? t.lobbyRated : t.lobbyUnrated}
                    </span>
                  </div>
                </div>

                {/* Join button */}
                <button
                  onClick={() => user ? handleJoin(slot) : undefined}
                  disabled={!user || joiningId === slot.id || isLoading}
                  title={!user ? t.loginToPlay : undefined}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                >
                  {joiningId === slot.id ? '...' : t.lobbyJoin}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
