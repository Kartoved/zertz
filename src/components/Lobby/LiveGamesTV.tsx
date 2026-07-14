import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import HexBoard from '../Board/HexBoard';
import { getTvGames, TvLiveGame, TvFallbackGame } from '../../db/roomsApi';
import { deserializeState, deserializeTree } from '../../db/apiClient';
import { rebuildStateFromNode } from '../../utils/gameTreeUtils';
import { GameState } from '../../game/types';
import { useI18n } from '../../i18n';

const POLL_MS = 4500;
const AUTO_ADVANCE_MS = 18000;
const REPLAY_STEP_MS = 1200;

function tcBadge(baseMs: number | null, incMs: number | null): string {
  if (incMs === -1 || baseMs == null) return '∞';
  const mins = Math.round(baseMs / 60000);
  const inc = Math.round((incMs || 0) / 1000);
  const icon = mins >= 30 ? '⏳' : mins >= 15 ? '🏇' : '⚡';
  return `${icon} ${mins}+${inc}`;
}

// Collects the main-line nodes (root → deepest, via children[0]) so the fallback
// game can be auto-replayed ply by ply.
function mainLineStates(treeJson: string, boardSize: 37 | 48 | 61): GameState[] {
  try {
    const root = deserializeTree(treeJson);
    const states: GameState[] = [];
    let node = root;
    while (true) {
      states.push(rebuildStateFromNode(node, boardSize));
      if (!node.children || node.children.length === 0) break;
      node = node.children[0];
    }
    return states;
  } catch {
    return [];
  }
}

function PlayersRow({
  names, ratings, countries,
}: {
  names: { player1: string; player2: string };
  ratings: { player1: number | null; player2: number | null };
  countries: { player1: string | null; player2: string | null };
}) {
  const Side = ({ name, rating, country }: { name: string; rating: number | null; country: string | null }) => (
    <div className="flex items-center gap-1 min-w-0">
      {country && <span className="flex-shrink-0 text-sm leading-none">{country}</span>}
      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{name}</span>
      {rating != null && <span className="text-xs font-semibold text-indigo-500 dark:text-indigo-300 flex-shrink-0">{rating}</span>}
    </div>
  );
  return (
    <div className="flex items-center justify-between gap-2 mt-2">
      <Side name={names.player1} rating={ratings.player1} country={countries.player1} />
      <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">vs</span>
      <Side name={names.player2} rating={ratings.player2} country={countries.player2} />
    </div>
  );
}

// Left-column "ZERTZ TV": one large auto-updating board broadcasting live games,
// with a slider to page through them. Real-time games lead, correspondence
// trails (server-ordered). When nothing is live, auto-replays the last finished
// game. The board refreshes on its own because each poll returns fresh state.
export default function LiveGamesTV() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [live, setLive] = useState<TvLiveGame[]>([]);
  const [fallback, setFallback] = useState<TvFallbackGame | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const hoveredRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const { live: l, fallback: fb } = await getTvGames();
      setLive(l);
      setFallback(l.length === 0 ? fb : null);
    } catch {
      /* keep last list on transient errors */
    }
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, POLL_MS);
    return () => clearInterval(iv);
  }, [refresh]);

  // Keep the shown game valid as the live list changes (index tracked by id,
  // so a reordered poll doesn't jump the view).
  useEffect(() => {
    if (live.length === 0) { setActiveId(null); return; }
    setActiveId(prev => (prev && live.some(g => g.id === prev) ? prev : live[0].id));
  }, [live]);

  const activeIndex = useMemo(
    () => Math.max(0, live.findIndex(g => g.id === activeId)),
    [live, activeId]
  );
  const current = live[activeIndex] ?? null;

  const go = useCallback((dir: 1 | -1) => {
    setLive(prev => {
      if (prev.length <= 1) return prev;
      setActiveId(id => {
        const i = Math.max(0, prev.findIndex(g => g.id === id));
        return prev[(i + dir + prev.length) % prev.length].id;
      });
      return prev;
    });
  }, []);

  // Auto-advance through live games (paused while hovered).
  useEffect(() => {
    if (live.length <= 1) return;
    const iv = setInterval(() => { if (!hoveredRef.current) go(1); }, AUTO_ADVANCE_MS);
    return () => clearInterval(iv);
  }, [live.length, go]);

  const liveState = useMemo(
    () => (current ? deserializeState(current.stateJson) : null),
    [current]
  );

  // ── Fallback replay ──
  const replayStates = useMemo(
    () => (fallback ? mainLineStates(fallback.treeJson, fallback.boardSize) : []),
    [fallback]
  );
  const [replayIdx, setReplayIdx] = useState(0);
  useEffect(() => { setReplayIdx(0); }, [fallback?.id]);
  useEffect(() => {
    if (replayStates.length <= 1) return;
    const iv = setInterval(() => setReplayIdx(i => (i + 1) % replayStates.length), REPLAY_STEP_MS);
    return () => clearInterval(iv);
  }, [replayStates]);

  const showLive = !!current && !!liveState;
  const showFallback = !showLive && !!fallback && replayStates.length > 0;
  const boardState = showLive ? liveState : showFallback ? replayStates[replayIdx] : null;

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-md p-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
          📺 {t.zertzTv}
          {showLive && (
            <span className="flex items-center gap-1 text-red-500 dark:text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>
          )}
        </h2>
        {showLive && live.length > 1 && (
          <span className="text-[11px] text-gray-400 dark:text-gray-500">{activeIndex + 1}/{live.length}</span>
        )}
      </div>

      {!boardState ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-6 text-center">{t.tvNoGames}</p>
      ) : (
        <div
          onMouseEnter={() => { hoveredRef.current = true; }}
          onMouseLeave={() => { hoveredRef.current = false; }}
        >
          <div className="relative">
            <button
              type="button"
              onClick={() => (showLive ? navigate(`/room/${current!.id}`) : navigate(`/room/${fallback!.id}`))}
              className="block w-full aspect-square rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
              title={t.watchGame}
            >
              <div className="w-full h-full" style={{ pointerEvents: 'none' }}>
                <HexBoard state={boardState} preview />
              </div>
            </button>

            {showLive && live.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  className="absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white text-lg leading-none backdrop-blur-sm"
                  aria-label="prev"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white text-lg leading-none backdrop-blur-sm"
                  aria-label="next"
                >
                  ›
                </button>
              </>
            )}
          </div>

          {showLive && current && (
            <>
              <PlayersRow names={current.playerNames} ratings={current.ratings} countries={current.countries} />
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-gray-500 dark:text-gray-400">{tcBadge(current.timeControl.baseMs, current.timeControl.incMs)}</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono text-gray-500 dark:text-gray-400">{current.boardSize}</span>
              </div>
            </>
          )}

          {showFallback && fallback && (
            <>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 uppercase tracking-wide">{t.tvLastGame}</p>
              <PlayersRow names={fallback.playerNames} ratings={fallback.ratings} countries={fallback.countries} />
            </>
          )}

          {showLive && live.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-2.5">
              {live.map((g, i) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setActiveId(g.id)}
                  className={`h-1.5 rounded-full transition-all ${i === activeIndex ? 'w-4 bg-indigo-500' : 'w-1.5 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400'}`}
                  aria-label={`game ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
