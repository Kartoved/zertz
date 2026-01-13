import { useState, useEffect } from 'react';
import { useUIStore } from '../../store/uiStore';
import { useGameStore } from '../../store/gameStore';

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export default function MainMenu() {
  const { setScreen, toggleDarkMode, isDarkMode } = useUIStore();
  const { newGame, savedGames, refreshSavedGames, loadSavedGame } = useGameStore();
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  
  useEffect(() => {
    refreshSavedGames();
  }, [refreshSavedGames]);
  
  const handleNewGame = () => {
    newGame();
    setScreen('game');
  };
  
  const handleLoadGame = async (gameId: string) => {
    await loadSavedGame(gameId);
    setShowLoadDialog(false);
    setScreen('game');
  };
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800">
      <div className="text-center mb-12">
        <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
          ZERTZ
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          Стратегическая игра с шариками
        </p>
      </div>
      
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button
          onClick={handleNewGame}
          className="w-full py-4 px-6 bg-blue-500 hover:bg-blue-600 text-white font-semibold 
            rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
        >
          Новая игра
        </button>
        
        <button
          onClick={() => setShowLoadDialog(true)}
          className="w-full py-4 px-6 bg-green-500 hover:bg-green-600 text-white font-semibold 
            rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
        >
          Загрузить игру
        </button>
        
        <button
          onClick={() => setScreen('rules')}
          className="w-full py-4 px-6 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 
            dark:hover:bg-gray-600 text-gray-800 dark:text-white font-semibold 
            rounded-xl shadow-md hover:shadow-lg transition-all"
        >
          Правила
        </button>
      </div>
      
      <button
        onClick={toggleDarkMode}
        className="mt-12 p-3 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 
          dark:hover:bg-gray-600 transition-colors"
      >
        {isDarkMode ? '☀️' : '🌙'}
      </button>
      
      <div className="mt-8 text-sm text-gray-500 dark:text-gray-500">
        v1.0 • 2 игрока • Локальная игра
      </div>
      
      {showLoadDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Загрузить игру</h2>
              <button 
                onClick={() => setShowLoadDialog(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-96">
              {savedGames.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  Нет сохранённых игр
                </p>
              ) : (
                <div className="space-y-2">
                  {savedGames.map(game => (
                    <button
                      key={game.id}
                      onClick={() => handleLoadGame(game.id)}
                      className="w-full p-3 text-left bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 
                        dark:hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {game.playerNames.player1} vs {game.playerNames.player2}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            Ходов: {game.moveCount}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-medium ${
                            game.winner ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'
                          }`}>
                            {game.winner ? `Победил ${game.winner === 'player1' ? game.playerNames.player1 : game.playerNames.player2}` : 'В процессе'}
                          </div>
                          <div className="text-xs text-gray-400">
                            {formatDate(game.updatedAt)}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
