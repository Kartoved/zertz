import { useI18n } from '../../i18n';
interface ActiveGamesWidgetProps {
  currentGames: any[];
  user: any;
  onLoadGame: (gameId: string) => void;
}

export default function ActiveGamesWidget({ currentGames, user, onLoadGame }: ActiveGamesWidgetProps) {
  const { t } = useI18n();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-4 flex flex-col w-full" style={{ maxHeight: '400px' }}>
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 px-1">{t.loadCurrent} ({currentGames.length})</h3>
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {currentGames.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8 text-sm">
            {t.noGames}
          </p>
        ) : (
          currentGames.map(game => {
            let isMyTurn = false;
            if (user && game.isOnline) {
              const isPlayer1 = game.playerNames.player1 === user.username;
              const isPlayer2 = game.playerNames.player2 === user.username;
              const isPlayer1Turn = game.moveCount % 2 === 1;
              isMyTurn = (isPlayer1 && isPlayer1Turn) || (isPlayer2 && !isPlayer1Turn);
            }
            
            return (
              <button
                key={game.id}
                onClick={() => onLoadGame(game.id)}
                className="w-full p-2.5 text-left bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 
                  dark:hover:bg-gray-700 rounded-xl transition-colors border-2 border-gray-200 dark:border-gray-700"
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5 text-sm truncate pr-2">
                    <span className="truncate">{game.playerNames.player1}</span>
                    <span className="text-gray-400 text-xs font-normal relative top-[1px]">vs</span>
                    <span className="truncate">{game.playerNames.player2}</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-end mt-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                      game.isOnline 
                        ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800' 
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
                    }`}>
                      {game.isOnline ? t.onlineLabel : t.localLabel}
                    </span>
                    {isMyTurn && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-300 border border-green-200 dark:border-green-800">
                        {t.yourTurn}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-400 font-medium">
                    {game.moveCount} {t.moves.toLowerCase()}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
