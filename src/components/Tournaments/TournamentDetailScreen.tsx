import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTournamentStore } from '../../store/tournamentStore';
import { useAuthStore } from '../../store/authStore';
import { useI18n, getWinTypeLabel } from '../../i18n';
import ConfirmModal from '../UI/ConfirmModal';
import TournamentForm, { TournamentFormValues } from './TournamentForm';
import TournamentLiveGames from './TournamentLiveGames';
import { useTournamentGames } from './useTournamentGames';
import { TournamentFinishedGame } from '../../db/tournamentApi';
import { getRoom } from '../../db/roomsApi';
import type { GameState } from '../../game/types';
import HexBoard from '../Board/HexBoard';
import { fmtCountdown } from './format';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function TournamentDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const tid = parseInt(id || '', 10);
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuthStore();
  const {
    detail, startDetailPolling, stopDetailPolling,
    join, pause, resume, editTournament, removeTournament, editSchedule, removeSchedule,
  } = useTournamentStore();

  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<{ message: string; danger?: boolean; onConfirm: () => Promise<void> } | null>(null);

  useEffect(() => {
    if (!Number.isInteger(tid)) return;
    startDetailPolling(tid);
    return () => stopDetailPolling();
  }, [tid, startDetailPolling, stopDetailPolling]);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Auto-open your game ONLY when the engine pairs you into a NEW one — never bounce
  // you back into a game you've already entered / deliberately left, so you can browse
  // the tournament page while playing. "Entered" is remembered per tournament (survives
  // refresh); room ids are globally unique, so a fresh pairing always differs.
  const currentRoomId = detail?.me?.currentRoomId ?? null;
  useEffect(() => {
    if (!currentRoomId) return;
    const key = `zertz_arena_entered:${tid}`;
    if (localStorage.getItem(key) === String(currentRoomId)) return;
    localStorage.setItem(key, String(currentRoomId));
    navigate(`/room/${currentRoomId}`);
  }, [currentRoomId, navigate, tid]);

  const act = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch { /* error surfaced via store */ } finally { setBusy(false); }
  }, []);

  // This tournament's games (separate ~4s poll from the 3s detail poll).
  const { live, finished } = useTournamentGames(tid);

  // Each player's finished games (indexed under both seats), oldest→newest, for
  // the clickable result markers in their standings row.
  const gamesByPlayer = useMemo(() => {
    const m = new Map<number, TournamentFinishedGame[]>();
    for (const g of finished) {
      for (const uid of [g.user1Id, g.user2Id]) {
        const arr = m.get(uid) || [];
        arr.push(g);
        m.set(uid, arr);
      }
    }
    for (const arr of m.values()) arr.sort((a, b) => a.updatedAt - b.updatedAt);
    return m;
  }, [finished]);

  // Lazy hover-preview of a finished game's final position (desktop).
  const [preview, setPreview] = useState<{ roomId: number; x: number; y: number } | null>(null);
  const [previewStates, setPreviewStates] = useState<Record<number, GameState | null>>({});
  const requestedRef = useRef<Set<number>>(new Set());
  const handleMarkerEnter = useCallback((roomId: number, e: React.MouseEvent) => {
    setPreview({ roomId, x: e.clientX, y: e.clientY });
    if (!requestedRef.current.has(roomId)) {
      requestedRef.current.add(roomId);
      getRoom(roomId)
        .then(room => setPreviewStates(p => ({ ...p, [roomId]: room?.state ?? null })))
        .catch(() => { /* leave unresolved */ });
    }
  }, []);

  if (!detail) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  const { tournament: tour, standings, me, schedule } = detail;
  const base = Math.round(tour.timeControlBaseMs / 60000);
  const inc = Math.round(tour.timeControlIncrementMs / 1000);
  const winnerRow = tour.winnerUserId ? standings.find(s => s.userId === tour.winnerUserId) : null;
  const isOwner = !!user && user.id === tour.createdBy;
  const canManage = isOwner && tour.status === 'scheduled';
  const isRecurring = tour.scheduleId != null && schedule != null;

  const handleEditSubmit = async (v: TournamentFormValues) => {
    await act(async () => {
      if (isRecurring && schedule) {
        // Editing a recurring instance edits the SERIES; the current instance is
        // replaced by a freshly materialized one, so return to the list.
        await editSchedule(schedule.id, {
          name: v.name, freq: v.repeat === 'once' ? 'weekly' : v.repeat,
          firstStartAt: v.startAtMs, durationMin: v.durationMin, boardSize: v.boardSize, berserk: v.berserk,
        });
        setEditing(false);
        navigate('/tournaments');
      } else {
        await editTournament(tour.id, {
          name: v.name, startsAt: v.startAtMs, durationMin: v.durationMin, boardSize: v.boardSize, berserk: v.berserk,
        });
        setEditing(false);
      }
    });
  };

  const podium = tour.status === 'finished' && standings.length > 0 && (
    <div className="rounded-xl bg-gradient-to-b from-amber-50 to-white dark:from-amber-900/20 dark:to-gray-800 border border-amber-200 dark:border-amber-700/40 p-4 mb-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-3">{t.arenaResults}</h2>
      <div className="space-y-2">
        {standings.slice(0, 3).map((s, i) => (
          <div key={s.userId} className="flex items-center gap-2">
            <span className="text-xl w-7 text-center">{MEDALS[i]}</span>
            <span className="text-lg">{s.country}</span>
            <span className="font-semibold text-gray-900 dark:text-white truncate flex-1">{s.username}</span>
            <span className="text-xs text-gray-400">({s.rating})</span>
            <span className="font-bold text-gray-900 dark:text-white">{s.score}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/tournaments')} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 text-xl" aria-label="Back">←</button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
            {isRecurring && <span title={t.arenaRecurring}>🔁 </span>}{tour.name}
          </h1>
        </div>

        {editing ? (
          <div className="mb-5">
            <TournamentForm
              repeatMode={isRecurring ? 'series' : 'none'}
              submitLabel={t.arenaSave}
              busy={busy}
              initial={{
                name: tour.name,
                startAtMs: tour.startsAt,
                durationMin: tour.durationMin,
                boardSize: tour.boardSize as 37 | 48 | 61,
                berserk: tour.berserkEnabled,
                repeat: isRecurring ? (schedule!.freq) : 'once',
              }}
              onSubmit={handleEditSubmit}
              onCancel={() => setEditing(false)}
            />
          </div>
        ) : (
          <>
            {podium}

            {/* Status card */}
            <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 mb-5">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
                <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono">{tour.boardSize}</span>
                <span>⏱ {base}+{inc}</span>
                {tour.berserkEnabled && <span title="Berserk">⚡</span>}
                {isRecurring && <span className="text-indigo-500">🔁 {t.arenaRecurring}</span>}
                <span className="ml-auto font-mono text-base text-gray-800 dark:text-gray-100">
                  {tour.status === 'scheduled' && <>{new Date(tour.startsAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</>}
                  {tour.status === 'active' && <>{t.arenaTimeLeft} {fmtCountdown(tour.finishesAt, now)}</>}
                  {tour.status === 'finished' && <>{t.arenaStatusFinished}</>}
                </span>
              </div>

              {tour.status === 'finished' && winnerRow && !podium && (
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

              {/* Owner controls (before start) */}
              {canManage && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-2">
                  <button onClick={() => setEditing(true)}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">
                    ✏️ {isRecurring ? t.arenaEditSeries : t.arenaEdit}
                  </button>
                  {isRecurring ? (
                    <>
                      <button onClick={() => setConfirm({ message: t.arenaSkipConfirm, onConfirm: async () => { await act(() => removeTournament(tour.id)); navigate('/tournaments'); } })}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">
                        {t.arenaSkipOccurrence}
                      </button>
                      <button onClick={() => setConfirm({ message: t.arenaStopSeriesConfirm, danger: true, onConfirm: async () => { await act(() => removeSchedule(schedule!.id)); navigate('/tournaments'); } })}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60">
                        🛑 {t.arenaStopSeries}
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setConfirm({ message: t.arenaDeleteConfirm, danger: true, onConfirm: async () => { await act(() => removeTournament(tour.id)); navigate('/tournaments'); } })}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60">
                      🗑 {t.arenaDelete}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Live games */}
            <TournamentLiveGames games={live} />

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
                            <div>
                              <span className="mr-1">{s.country}</span>
                              <span className="font-medium text-gray-800 dark:text-gray-100">{s.username}</span>
                              <span className="text-xs text-gray-400 ml-1">({s.rating})</span>
                              {s.playing && <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-green-500 align-middle" title="playing" />}
                              {s.paused && <span className="ml-1.5 text-xs text-gray-400">⏸</span>}
                            </div>
                            {(() => {
                              const pg = gamesByPlayer.get(s.userId);
                              if (!pg || pg.length === 0) return null;
                              return (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {pg.map(g => {
                                    const side = g.user1Id === s.userId ? 'player1' : 'player2';
                                    const oppSide = side === 'player1' ? 'player2' : 'player1';
                                    const won = g.winnerUserId === s.userId;
                                    const berserked = g.berserk[side];
                                    return (
                                      <button
                                        key={g.roomId}
                                        onClick={() => navigate(`/room/${g.roomId}?watch=1`)}
                                        onMouseEnter={e => handleMarkerEnter(g.roomId, e)}
                                        onMouseMove={e => setPreview(p => (p?.roomId === g.roomId ? { roomId: g.roomId, x: e.clientX, y: e.clientY } : p))}
                                        onMouseLeave={() => setPreview(null)}
                                        title={`${getWinTypeLabel(t, g.winType)} · ${g.playerNames[oppSide]}`}
                                        className={`w-4 h-4 rounded-sm text-[9px] leading-none flex items-center justify-center ${won ? 'bg-green-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-300'}`}
                                      >
                                        {berserked ? '⚡' : ''}
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            })()}
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
          </>
        )}
      </div>

      {confirm && (
        <ConfirmModal
          message={confirm.message}
          danger={confirm.danger}
          onClose={() => setConfirm(null)}
          onConfirm={async () => { const fn = confirm.onConfirm; setConfirm(null); await fn(); }}
        />
      )}

      {/* Hover preview of a finished game's final position (desktop). */}
      {preview && (
        <div
          className="hidden sm:block fixed z-50 pointer-events-none"
          style={{
            left: Math.min(preview.x + 16, (typeof window !== 'undefined' ? window.innerWidth : 9999) - 176),
            top: Math.min(preview.y + 16, (typeof window !== 'undefined' ? window.innerHeight : 9999) - 176),
          }}
        >
          <div className="w-40 h-40 rounded-lg overflow-hidden border-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 shadow-xl">
            {previewStates[preview.roomId]
              ? <HexBoard state={previewStates[preview.roomId] as GameState} preview />
              : <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">…</div>}
          </div>
        </div>
      )}
    </div>
  );
}
