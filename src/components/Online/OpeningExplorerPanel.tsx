import { useEffect, useMemo, useState } from 'react';
import { useRoomStore } from '../../store/roomStore';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import { lookupExplorerPosition, ExplorerLookupResult } from '../../db/explorerApi';
import { canonicalizeState, decanonicalizeMove } from '../../../shared/explorer/canonicalize.js';
import { hashPosition } from '../../../shared/explorer/hash.js';
import type { Move } from '../../game/types';

/**
 * Opening-explorer panel — visible only inside analysis mode. Watches the
 * current analysis position, hashes it, and shows aggregate stats from past
 * games that passed through this same position (modulo board symmetries).
 *
 * Click a move row to play that move in the analysis tree. The canonical
 * move from the API is decanonicalized into the user's frame using the
 * inverse of the transform that brought their state to canonical form.
 */
export default function OpeningExplorerPanel() {
  const { t } = useI18n();
  const {
    isAnalyzing,
    analysisState,
    analysisCurrentNode,
    analysisSelectMarbleColor,
    analysisHandlePlacement,
    analysisHandleRingRemoval,
    analysisHandleCapture,
  } = useRoomStore();
  const { user } = useAuthStore();

  const [data, setData] = useState<ExplorerLookupResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterMine, setFilterMine] = useState(false);

  // Compute canonical hash + transform indices once per analysis-state change.
  const hashAndTransforms = useMemo(() => {
    if (!analysisState) return null;
    const { canonicalString, transformIndices } = canonicalizeState(analysisState);
    return {
      hash: hashPosition(canonicalString),
      transformIndices,
      boardSize: analysisState.boardSize as 37 | 48 | 61,
    };
  }, [analysisState, analysisCurrentNode]);

  useEffect(() => {
    if (!isAnalyzing || !hashAndTransforms) {
      setData(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    const playerId = filterMine && user ? user.id : null;
    lookupExplorerPosition({
      hash: hashAndTransforms.hash,
      boardSize: hashAndTransforms.boardSize,
      playerId,
    })
      .then(res => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setError(t.explorerLoadError);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [isAnalyzing, hashAndTransforms, filterMine, user, t.explorerLoadError]);

  if (!isAnalyzing) return null;

  const playMove = (canonMove: Move) => {
    if (!hashAndTransforms || !analysisState) return;
    const userMove = decanonicalizeMove(
      canonMove,
      hashAndTransforms.transformIndices,
      analysisState.boardSize
    ) as Move;

    if (userMove.type === 'placement') {
      const { marbleColor, ringId, removedRingId } = userMove.data;
      // analysisHandlePlacement reads selectedMarbleColor from the store.
      analysisSelectMarbleColor(marbleColor);
      analysisHandlePlacement(ringId);
      if (removedRingId) {
        analysisHandleRingRemoval(removedRingId);
      }
    } else {
      const chain = [userMove.data, ...(userMove.data.chain || [])];
      analysisHandleCapture(chain);
    }
  };

  const totalGames = data?.moves.reduce((s, m) => s + m.total, 0) ?? 0;

  return (
    <div className="col-span-1 sm:col-span-2 lg:col-span-1 p-3 bg-white dark:bg-gray-800 rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">
          📚 {t.openingExplorer}
        </div>
        {user && (
          <button
            type="button"
            onClick={() => setFilterMine(v => !v)}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              filterMine
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
            title={t.explorerFilterMineHint}
          >
            {filterMine ? `✓ ${t.explorerOnlyMine}` : t.explorerOnlyMine}
          </button>
        )}
      </div>

      {isLoading && (
        <div className="text-xs text-gray-500 dark:text-gray-400 italic">{t.loading}</div>
      )}
      {error && (
        <div className="text-xs text-red-500">{error}</div>
      )}
      {!isLoading && !error && data && data.moves.length === 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400 italic">
          {t.explorerNoGames}
        </div>
      )}
      {!isLoading && !error && data && data.moves.length > 0 && (
        <>
          <div className="text-[10px] text-gray-500 dark:text-gray-400">
            {t.explorerTotalGames}: {totalGames}
          </div>
          <ul className="space-y-1 max-h-64 overflow-y-auto">
            {data.moves.map(m => {
              const p1Pct = m.total > 0 ? Math.round((m.player1Wins / m.total) * 100) : 0;
              const p2Pct = m.total > 0 ? Math.round((m.player2Wins / m.total) * 100) : 0;
              const drawPct = Math.max(0, 100 - p1Pct - p2Pct);
              return (
                <li key={m.moveNotation}>
                  <button
                    type="button"
                    onClick={() => playMove(m.move)}
                    className="w-full px-2 py-1.5 text-left bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-xs transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">
                        {m.moveNotation}
                      </span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        {m.total}
                      </span>
                    </div>
                    <div className="mt-1 flex h-1.5 rounded overflow-hidden bg-gray-200 dark:bg-gray-800">
                      {p1Pct > 0 && <div className="bg-blue-400 dark:bg-blue-500" style={{ width: `${p1Pct}%` }} />}
                      {drawPct > 0 && <div className="bg-gray-400" style={{ width: `${drawPct}%` }} />}
                      {p2Pct > 0 && <div className="bg-rose-400 dark:bg-rose-500" style={{ width: `${p2Pct}%` }} />}
                    </div>
                    <div className="mt-0.5 flex justify-between text-[9px] text-gray-500 dark:text-gray-400">
                      <span>P1 {p1Pct}%</span>
                      {drawPct > 0 && <span>= {drawPct}%</span>}
                      <span>P2 {p2Pct}%</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

    </div>
  );
}
