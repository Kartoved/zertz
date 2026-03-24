import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n, getWinTypeLabel } from '../../i18n';
import { listPublicGames } from '../../db/gamesApi';
import { getActiveRoomsForPlayer } from '../../db/roomsApi';

type GameSummary = {
  id: string;
  playerNames: { player1: string; player2: string };
  updatedAt: number;
  moveCount: number;
  winner: string | null;
  winType: string | null;
  boardSize: 37 | 48 | 61;
  isOnline: boolean;
};

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

interface PlayerGamesModalProps {
  username: string;
  onClose: () => void;
}

export default function PlayerGamesModal({ username, onClose }: PlayerGamesModalProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [games, setGames] = useState<GameSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      getActiveRoomsForPlayer(username),
      listPublicGames(username),
    ])
      .then(([active, completed]) => {
        // Active rooms first, then completed games; deduplicate by id
        const seen = new Set<string>();
        const all: GameSummary[] = [];
        for (const g of [...active, ...completed]) {
          if (!seen.has(String(g.id))) {
            seen.add(String(g.id));
            all.push(g as GameSummary);
          }
        }
        setGames(all);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [username]);

  const handleGameClick = (game: GameSummary) => {
    onClose();
    navigate(`/room/${game.id}`);
  };

  const renderWinner = (game: GameSummary) => {
    if (!game.winner) return t.inProgress;
    if (game.winner === 'cancelled') return t.cancelledStatus;
    return game.winner === 'player1' ? game.playerNames.player1 : game.playerNames.player2;
  };

  const winnerColor = (game: GameSummary) => {
    if (!game.winner) return 'text-yellow-600 dark:text-yellow-400';
    if (game.winner === 'cancelled') return 'text-gray-500 dark:text-gray-400';
    return 'text-green-600 dark:text-green-400';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[70]">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {t.viewGamesBtn}: {username}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">✕</button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {isLoading ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">{t.loading}</p>
          ) : games.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">{t.noGames}</p>
          ) : (
            <div className="space-y-2">
              {games.map(game => (
                <button
                  key={game.id}
                  onClick={() => handleGameClick(game)}
                  className="w-full p-3 text-left bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {game.playerNames.player1} vs {game.playerNames.player2}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {t.moves}: {game.moveCount}
                      </div>
                      {game.winType && game.winner !== 'cancelled' && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {getWinTypeLabel(t, game.winType)}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${winnerColor(game)}`}>
                        {renderWinner(game)}
                      </div>
                      {!game.winner && (
                        <div className="text-xs text-blue-500 dark:text-blue-400 font-medium mt-0.5">
                          👁 {t.watchGame}
                        </div>
                      )}
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
  );
}
