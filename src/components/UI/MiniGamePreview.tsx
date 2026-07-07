import { useEffect, useState } from 'react';
import HexBoard from '../Board/HexBoard';
import { GameState } from '../../game/types';
import { loadGame } from '../../db/gamesStorage';
import { useI18n } from '../../i18n';

interface MiniGamePreviewProps {
  gameId: string;
  playerNames: { player1: string; player2: string };
  moveCount: number;
  isOnline: boolean;
  onClick: () => void;
  /** Board preview edge in px. Mobile carousel uses the default 148; desktop uses a larger value. */
  size?: number;
  /** true = it's the viewer's move (shows a highlighted badge); null/undefined = not applicable. */
  isMyTurn?: boolean | null;
}

export default function MiniGamePreview({ gameId, playerNames, moveCount, isOnline, onClick, size = 148, isMyTurn }: MiniGamePreviewProps) {
  const { t } = useI18n();
  const [gameState, setGameState] = useState<GameState | null>(null);

  useEffect(() => {
    loadGame(gameId).then(data => {
      if (data) setGameState(data.state);
    });
  }, [gameId]);

  return (
    <div
      onClick={onClick}
      className={`snap-start flex-shrink-0 flex flex-col cursor-pointer rounded-xl overflow-hidden border-2 bg-white dark:bg-gray-800 shadow-sm active:scale-95 transition-transform ${
        isMyTurn
          ? 'border-green-400 dark:border-green-500 hover:border-green-500 dark:hover:border-green-400'
          : 'border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500'
      }`}
      style={{ width: size + 4 }}
    >
      {/* Mini board */}
      <div
        className="relative overflow-hidden bg-gray-50 dark:bg-gray-900"
        style={{ width: size, height: size, flexShrink: 0 }}
      >
        {gameState ? (
          <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
            <HexBoard state={gameState} preview />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">…</div>
        )}
        {isOnline && (
          <div className="absolute top-1 right-1 text-[9px] bg-indigo-500 text-white px-1 py-0.5 rounded font-bold leading-none">
            Online
          </div>
        )}
      </div>

      {/* Game info */}
      <div className="px-1.5 py-1 min-w-0" style={{ width: size }}>
        <div className="text-[10px] font-semibold text-gray-700 dark:text-gray-200 truncate leading-tight">
          {playerNames.player1} vs {playerNames.player2}
        </div>
        <div className="flex items-center gap-1.5">
          {isMyTurn === true && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-300 font-semibold leading-none">
              {t.yourTurn}
            </span>
          )}
          {isMyTurn === false && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300 font-semibold leading-none">
              {t.opponentTurn}
            </span>
          )}
          <span className="text-[9px] text-gray-400 dark:text-gray-500">
            {moveCount - 1} {t.moves.toLowerCase()}
          </span>
        </div>
      </div>
    </div>
  );
}
