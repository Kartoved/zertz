import { useEffect, useState } from 'react';
import HexBoard from '../Board/HexBoard';
import { GameState } from '../../game/types';
import { loadGame } from '../../db/gamesStorage';

interface MiniGamePreviewProps {
  gameId: string;
  playerNames: { player1: string; player2: string };
  moveCount: number;
  isOnline: boolean;
  onClick: () => void;
}

const PREVIEW_PX = 148;
const SCALE = 0.32;
const INNER_PX = Math.round(PREVIEW_PX / SCALE);

export default function MiniGamePreview({ gameId, playerNames, moveCount, isOnline, onClick }: MiniGamePreviewProps) {
  const [gameState, setGameState] = useState<GameState | null>(null);

  useEffect(() => {
    loadGame(gameId).then(data => {
      if (data) setGameState(data.state);
    });
  }, [gameId]);

  return (
    <div
      onClick={onClick}
      className="snap-start flex-shrink-0 flex flex-col cursor-pointer rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 bg-white dark:bg-gray-800 shadow-sm active:scale-95 transition-transform"
      style={{ width: PREVIEW_PX + 4 }}
    >
      {/* Mini board */}
      <div
        className="relative overflow-hidden bg-gray-50 dark:bg-gray-900"
        style={{ width: PREVIEW_PX, height: PREVIEW_PX, flexShrink: 0 }}
      >
        {gameState ? (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: INNER_PX,
              height: INNER_PX,
              transform: `scale(${SCALE})`,
              transformOrigin: 'top left',
              pointerEvents: 'none',
            }}
          >
            <HexBoard state={gameState} />
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
      <div className="px-1.5 py-1 min-w-0" style={{ width: PREVIEW_PX }}>
        <div className="text-[10px] font-semibold text-gray-700 dark:text-gray-200 truncate leading-tight">
          {playerNames.player1} vs {playerNames.player2}
        </div>
        <div className="text-[9px] text-gray-400 dark:text-gray-500">
          {moveCount} ходов
        </div>
      </div>
    </div>
  );
}
