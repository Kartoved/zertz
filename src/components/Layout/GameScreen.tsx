import { useState } from 'react';
import HexBoard from '../Board/HexBoard';
import MarbleSelector from '../UI/MarbleSelector';
import GameStats from '../UI/GameStats';
import ControlPanel from '../UI/ControlPanel';
import MoveHistory from '../UI/MoveHistory';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { getWinType } from '../../game/GameEngine';
import { getWinTypeLabel, useI18n } from '../../i18n';

export default function GameScreen() {
  const { t } = useI18n();
  const { state, playerNames, newGame } = useGameStore();
  const { toggleDarkMode, isDarkMode, setScreen } = useUIStore();
  const [showRematchDialog, setShowRematchDialog] = useState(false);
  
  const isGameOver = state.phase === 'gameOver';
  const winType = state.winner ? getWinType(state, state.winner) : null;
  const winnerName = state.winner === 'player1' ? playerNames.player1 : playerNames.player2;
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 transition-colors">
      <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ZERTZ</h1>
        <div className="flex-1 mx-4">
          <MoveHistory />
        </div>
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 
            dark:hover:bg-gray-600 transition-colors"
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>
      </header>
      
      <main className="flex-1 flex flex-col lg:flex-row gap-4 p-4 max-w-7xl mx-auto w-full">
        <div className="flex-1 flex flex-col items-center justify-center">
          <HexBoard />
        </div>
        
        <aside className="lg:w-80 flex flex-col gap-4">
          <GameStats />
          
          {!isGameOver && (
            <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md">
              <MarbleSelector />
            </div>
          )}
          
          <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md">
            <ControlPanel />
          </div>
          
          {state.phase === 'ringRemoval' && (
            <div className="p-4 bg-yellow-100 dark:bg-yellow-900 rounded-xl">
              <div className="text-yellow-800 dark:text-yellow-200 font-medium">
                ⚠️ {t.removeRing}
              </div>
              <div className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                {t.freeRingLead}
              </div>
            </div>
          )}
        </aside>
      </main>

      {isGameOver && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 text-center">
            <div className="text-3xl font-bold text-green-700 dark:text-green-300 mb-2">
              🎉 {winnerName}!
            </div>
            <div className="text-base text-gray-700 dark:text-gray-300 mb-6">
              {winType ? getWinTypeLabel(t, winType) : t.winUnknown}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowRematchDialog(true)}
                className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
              >
                {t.rematch}
              </button>
              <button
                onClick={() => setScreen('menu')}
                className="flex-1 py-2 px-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                {t.backToMenu}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRematchDialog && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t.rematchChooseBoard}</h2>
              <button
                onClick={() => setShowRematchDialog(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              {([37, 48, 61] as const).map((boardSize) => (
                <button
                  key={boardSize}
                  onClick={() => {
                    newGame(boardSize);
                    setShowRematchDialog(false);
                  }}
                  className="w-full p-3 text-left bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  {boardSize === 37 ? t.board37 : boardSize === 48 ? t.board48 : t.board61}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
