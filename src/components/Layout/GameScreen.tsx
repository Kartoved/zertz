import HexBoard from '../Board/HexBoard';
import MarbleSelector from '../UI/MarbleSelector';
import GameStats from '../UI/GameStats';
import ControlPanel from '../UI/ControlPanel';
import MoveHistory from '../UI/MoveHistory';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { getWinType } from '../../game/GameEngine';

const WIN_TYPE_LABELS: Record<string, string> = {
  white: 'Победа по белым шарикам!',
  gray: 'Победа по серым шарикам!',
  black: 'Победа по чёрным шарикам!',
  mixed: 'Победа по разным шарикам!',
  unknown: 'Победа!',
};

export default function GameScreen() {
  const { state, playerNames } = useGameStore();
  const { toggleDarkMode, isDarkMode } = useUIStore();
  
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
          {isGameOver && (
            <div className="mb-4 p-6 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900 dark:to-emerald-900 rounded-xl text-center shadow-lg">
              <div className="text-3xl font-bold text-green-800 dark:text-green-200 mb-2">
                🎉 {winnerName} победил!
              </div>
              <div className="text-lg text-green-700 dark:text-green-300">
                {winType ? WIN_TYPE_LABELS[winType] : 'Победа!'}
              </div>
            </div>
          )}
          
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
                ⚠️ Выберите кольцо для удаления
              </div>
              <div className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Зелёным подсвечены доступные кольца
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
