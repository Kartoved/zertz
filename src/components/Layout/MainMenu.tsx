import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../../store/uiStore';
import { useGameStore } from '../../store/gameStore';
import { useRoomStore } from '../../store/roomStore';

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

const BOARD_LABELS: Record<number, string> = {
  37: 'Любительское 37 колец',
  48: 'Турнирное 48 колец',
  61: 'Турнирное 61 кольцо',
};

const WIN_TYPE_LABELS: Record<string, string> = {
  white: 'по белым',
  gray: 'по серым',
  black: 'по чёрным',
  mixed: 'по разным',
  unknown: 'победа',
};

export default function MainMenu() {
  const navigate = useNavigate();
  const { setScreen, toggleDarkMode, isDarkMode } = useUIStore();
  const { newGame, savedGames, refreshSavedGames, loadSavedGame } = useGameStore();
  const { createRoom, isLoading: isCreatingRoom } = useRoomStore();
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showBoardDialog, setShowBoardDialog] = useState(false);
  const [showOnlineDialog, setShowOnlineDialog] = useState(false);
  const [onlineStep, setOnlineStep] = useState<'board' | 'player' | 'link'>('board');
  const [selectedBoardSize, setSelectedBoardSize] = useState<37 | 48 | 61>(37);
  const [selectedPlayer, setSelectedPlayer] = useState<1 | 2 | 'random'>(1);
  const [createdRoomId, setCreatedRoomId] = useState<number | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  
  useEffect(() => {
    refreshSavedGames();
  }, [refreshSavedGames]);
  
  const handleNewGame = () => {
    setShowBoardDialog(true);
  };

  const handleSelectBoard = (boardSize: 37 | 48 | 61) => {
    newGame(boardSize);
    setShowBoardDialog(false);
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
          Абстрактная стратегическая игра
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
            rounded-xl shadow-md hover:shadow-lg transition-all transform hover:scale-105"
        >
          Правила
        </button>

        <button
          onClick={() => setShowOnlineDialog(true)}
          className="w-full py-4 px-6 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-xl 
            shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
        >
          Сыграть онлайн
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
        v2.0 • 2 игрока • Локальная и онлайн игра
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
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            Поле: {BOARD_LABELS[game.boardSize] ?? `${game.boardSize} колец`}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            Способ победы: {game.winType ? WIN_TYPE_LABELS[game.winType] ?? game.winType : '—'}
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

      {showBoardDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Выберите поле</h2>
              <button
                onClick={() => setShowBoardDialog(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <button
                onClick={() => handleSelectBoard(37)}
                className="w-full p-3 text-left bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 
                  dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Любительское 37 колец
              </button>
              <button
                onClick={() => handleSelectBoard(48)}
                className="w-full p-3 text-left bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 
                  dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Турнирное 48 колец
              </button>
              <button
                onClick={() => handleSelectBoard(61)}
                className="w-full p-3 text-left bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 
                  dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                Турнирное 61 кольцо
              </button>
            </div>
          </div>
        </div>
      )}

      {showOnlineDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {onlineStep === 'board' && 'Выберите размер поля'}
                {onlineStep === 'player' && 'Выберите игрока'}
                {onlineStep === 'link' && 'Ссылка для приглашения'}
              </h2>
              <button
                onClick={() => {
                  setShowOnlineDialog(false);
                  setOnlineStep('board');
                  setCreatedRoomId(null);
                  setLinkCopied(false);
                }}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              {onlineStep === 'board' && (
                <>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Выберите размер поля для онлайн-игры.
                  </p>
                  <div className="space-y-3">
                    {([37, 48, 61] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => {
                          setSelectedBoardSize(size);
                          setOnlineStep('player');
                        }}
                        className={`w-full p-3 text-left rounded-lg transition-colors ${
                          selectedBoardSize === size
                            ? 'bg-purple-100 dark:bg-purple-900 border-2 border-purple-500'
                            : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {BOARD_LABELS[size]}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {onlineStep === 'player' && (
                <>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Каким игроком вы хотите играть?
                  </p>
                  <div className="space-y-3">
                    <button
                      onClick={() => setSelectedPlayer(1)}
                      className={`w-full p-3 text-left rounded-lg transition-colors ${
                        selectedPlayer === 1
                          ? 'bg-purple-100 dark:bg-purple-900 border-2 border-purple-500'
                          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <div className="font-medium">Первый игрок</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Ходите первым</div>
                    </button>
                    <button
                      onClick={() => setSelectedPlayer(2)}
                      className={`w-full p-3 text-left rounded-lg transition-colors ${
                        selectedPlayer === 2
                          ? 'bg-purple-100 dark:bg-purple-900 border-2 border-purple-500'
                          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <div className="font-medium">Второй игрок</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Ходите вторым</div>
                    </button>
                    <button
                      onClick={() => setSelectedPlayer('random')}
                      className={`w-full p-3 text-left rounded-lg transition-colors ${
                        selectedPlayer === 'random'
                          ? 'bg-purple-100 dark:bg-purple-900 border-2 border-purple-500'
                          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <div className="font-medium">Случайно</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Случайный выбор</div>
                    </button>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setOnlineStep('board')}
                      className="flex-1 py-2 px-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white 
                        rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      Назад
                    </button>
                    <button
                      disabled={isCreatingRoom}
                      onClick={async () => {
                        try {
                          const player = selectedPlayer === 'random' 
                            ? (Math.random() < 0.5 ? 1 : 2) 
                            : selectedPlayer;
                          const roomId = await createRoom(selectedBoardSize, player);
                          setCreatedRoomId(roomId);
                          setOnlineStep('link');
                        } catch {
                          alert('Не удалось создать комнату. Проверьте подключение к серверу.');
                        }
                      }}
                      className="flex-1 py-2 px-4 bg-purple-500 hover:bg-purple-600 text-white font-semibold 
                        rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isCreatingRoom ? 'Создание...' : 'Создать игру'}
                    </button>
                  </div>
                </>
              )}

              {onlineStep === 'link' && createdRoomId && (
                <>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Игра создана! Отправьте ссылку другу для подключения.
                  </p>
                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 mb-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Ссылка на игру:</div>
                    <a 
                      href={`${window.location.origin}/room/${createdRoomId}`}
                      className="text-purple-600 dark:text-purple-400 hover:underline break-all font-medium"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {window.location.origin}/room/{createdRoomId}
                    </a>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/room/${createdRoomId}`);
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 2000);
                      }}
                      className="flex-1 py-2 px-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white 
                        rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      {linkCopied ? '✓ Скопировано!' : 'Копировать ссылку'}
                    </button>
                    <button
                      onClick={() => {
                        setShowOnlineDialog(false);
                        setOnlineStep('board');
                        navigate(`/room/${createdRoomId}`);
                      }}
                      className="flex-1 py-2 px-4 bg-purple-500 hover:bg-purple-600 text-white font-semibold 
                        rounded-lg transition-colors"
                    >
                      Перейти к игре
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
