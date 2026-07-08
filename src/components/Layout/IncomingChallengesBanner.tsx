import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getChallenges, acceptChallenge, declineChallenge, Challenge } from '../../db/authApi';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';

// Prominent menu banner for pending incoming challenges so they aren't missed
// behind the header icon. Self-contained: polls, and accepts/declines inline
// (accept navigates straight into the room). Renders nothing when there are none.
export default function IncomingChallengesBanner() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user, pollChallenges } = useAuthStore();
  const [incoming, setIncoming] = useState<Challenge[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!user) { setIncoming([]); return; }
    try {
      const all = await getChallenges();
      setIncoming(all.filter(c => c.toUserId === user.id && c.status === 'pending'));
    } catch {
      /* ignore transient errors */
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    refresh();
    const iv = setInterval(refresh, 8000);
    return () => clearInterval(iv);
  }, [refresh, user?.id]);

  const accept = async (c: Challenge) => {
    setBusyId(c.id);
    try {
      const { roomId } = await acceptChallenge(c.id);
      pollChallenges();
      navigate(`/room/${roomId}`);
    } catch {
      setBusyId(null);
    }
  };

  const decline = async (c: Challenge) => {
    setBusyId(c.id);
    try {
      await declineChallenge(c.id);
      setIncoming(prev => prev.filter(x => x.id !== c.id));
      pollChallenges();
    } finally {
      setBusyId(null);
    }
  };

  if (incoming.length === 0) return null;

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-md p-4 mb-4 border-l-4 border-indigo-500">
      <h2 className="text-xs font-bold text-indigo-600 dark:text-indigo-300 uppercase tracking-wide mb-3">
        ⚔ {t.incomingChallenges} ({incoming.length})
      </h2>
      <div className="flex flex-col gap-2">
        {incoming.map(c => (
          <div
            key={c.id}
            className="flex items-center gap-3 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-100 min-w-0">
                {c.fromCountry && <span className="flex-shrink-0 leading-none">{c.fromCountry}</span>}
                <span className="truncate">{c.fromUsername}</span>
                <span className="text-xs text-indigo-500 dark:text-indigo-300 flex-shrink-0">{c.fromRating}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                <span className="font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700">{c.boardSize}</span>
                <span className={`px-1.5 py-0.5 rounded font-medium ${
                  c.rated
                    ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                }`}>
                  {c.rated ? t.lobbyRated : t.lobbyUnrated}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                disabled={busyId === c.id}
                onClick={() => accept(c)}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-green-500 hover:bg-green-600 text-white transition-colors disabled:opacity-50"
              >
                {t.accepted}
              </button>
              <button
                type="button"
                disabled={busyId === c.id}
                onClick={() => decline(c)}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors disabled:opacity-50"
              >
                {t.decline}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
