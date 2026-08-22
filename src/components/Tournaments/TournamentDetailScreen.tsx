import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTournamentStore } from '../../store/tournamentStore';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';

function fmtCountdown(target: number, now: number): string {
  const ms = Math.max(0, target - now);
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TournamentDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const tid = parseInt(id || '', 10);
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuthStore();
  const { detail, startDetailPolling, stopDetailPolling, join, pause, resume } = useTournamentStore();

  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const navigatedRoomRef = useRef<number | null>(null);

  useEffect(() => {
    if (!Number.isInteger(tid)) return;
    startDetailPolling(tid);
    return () => stopDetailPolling();
  }, [tid, startDetailPolling, stopDetailPolling]);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Pairing discovery: when the engine seats us in a game, jump into the room.
  // Guarded by a ref so we don't bounce back into a room we already left.
  const currentRoomId = detail?.me?.currentRoomId ?? null;
  useEffect(() => {
    if (currentRoomId && navigatedRoomRef.current !== currentRoomId) {
      navigatedRoomRef.current = currentRoomId;
      navigate(`/room/${currentRoomId}`);
    }
    if (!currentRoomId) navigatedRoomRef.current = null;
  }, [currentRoomId, navigate]);

  const act = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch { /* error surfaced via store */ } finally { setBusy(false); }
  }, []);

  if (!detail) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  const { tournament: tour, standings, me } = detail;
  const base = Math.round(tour.timeControlBaseMs / 60000);
  const inc = Math.round(tour.timeControlIncrementMs / 1000);
  const winnerRow = tour.winnerUserId ? standings.find(s => s.userId === tour.winnerUserId) : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/tournaments')} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-xl" aria-label="Back">←</button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">{tour.name}</h1>
        </div>

        {/* Status card */}
        <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 mb-5">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
            <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono">{tour.boardSize}</span>
            <span>⏱ {base}+{inc}</span>
            {tour.berserkEnabled && <span title="Berserk">⚡</span>}
            <span className="ml-auto font-mono text-base text-gray-800 dark:text-gray-100">
              {tour.status === 'scheduled' && <>{t.arenaStartsIn} {fmtCountdown(tour.startsAt, now)}</>}
              {tour.status === 'active' && <>{t.arenaTimeLeft} {fmtCountdown(tour.finishesAt, now)}</>}
              {tour.status === 'finished' && <>{t.arenaStatusFinished}</>}
            </span>
          </div>

          {tour.status === 'finished' && winnerRow && (
            <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
              🏆 {t.arenaWinner}: {winnerRow.country} {winnerRow.username} — {winnerRow.score}
            </p>
          )}

          {/* In-game banner */}
          {currentRoomId && (
            <button onClick={() => navigate(`/room/${currentRoomId}`)}
              className="w-full mt-2 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-semibold">
              ▶ {t.arenaGameReady} — {t.arenaGoToGame}
            </button>
          )}

          {/* Join / pause / resume */}
          {tour.status !== 'finished' && !currentRoomId && (
            <div className="mt-2">
              {!user ? (
                <p className="text-center text-sm text-gray-500 dark:text-gray-400">{t.loginToPlay}</p>
              ) : !me?.joined ? (
                <button onClick={() => act(() => join(tid))} disabled={busy}
                  className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold">
                  {t.arenaJoin}
                </button>
              ) : me.paused ? (
                <button onClick={() => act(() => resume(tid))} disabled={busy}
                  className="w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold">
                  {t.arenaResume}
                </button>
              ) : (
                <button onClick={() => act(() => pause(tid))} disabled={busy}
                  className="w-full py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-semibold">
                  {t.arenaPause}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Standings */}
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
          {t.arenaPlayers} ({standings.length})
        </h2>
        {standings.length === 0 ? (
          <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-8">{t.arenaNoPlayers}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-3 py-2 text-left font-medium w-8">#</th>
                  <th className="px-3 py-2 text-left font-medium">{t.arenaPlayers}</th>
                  <th className="px-2 py-2 text-right font-medium">{t.arenaStreak}</th>
                  <th className="px-3 py-2 text-right font-medium">{t.arenaScore}</th>
                </tr>
              </thead>
              <tbody>
                {standings.map(s => {
                  const isMe = user && s.userId === user.id;
                  return (
                    <tr key={s.userId}
                      className={`border-t border-gray-100 dark:border-gray-700/60 ${isMe ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'bg-white dark:bg-gray-800'}`}>
                      <td className="px-3 py-2 text-gray-400 dark:text-gray-500 font-mono">{s.rank}</td>
                      <td className="px-3 py-2">
                        <span className="mr-1">{s.country}</span>
                        <span className="font-medium text-gray-800 dark:text-gray-100">{s.username}</span>
                        <span className="text-xs text-gray-400 ml-1">({s.rating})</span>
                        {s.playing && <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-green-500 align-middle" title="playing" />}
                        {s.paused && <span className="ml-1.5 text-xs text-gray-400">⏸</span>}
                      </td>
                      <td className="px-2 py-2 text-right text-gray-500 dark:text-gray-400">
                        {s.streak >= 2 ? `🔥${s.streak}` : s.streak || ''}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-gray-900 dark:text-white">{s.score}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
