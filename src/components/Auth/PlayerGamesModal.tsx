import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n, getWinTypeLabel } from '../../i18n';
import { listPublicGames } from '../../db/gamesApi';
import { getActiveRooms } from '../../db/roomsApi';

type GameSummary = {
  id: string;
  playerNames: { player1: string; player2: string };
  updatedAt: number;
  moveCount: number;
  winner: string | null;
  winType: string | null;
  boardSize: 37 | 48 | 61;
  isOnline: boolean;
  rated?: boolean;
};

type TabKey = 'active' | 'finished';

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

interface PlayerGamesModalProps {
  // When provided, the modal opens with the "Only this player" filter pre-applied
  // and the title shows the username. The user can switch the filter to All
  // players. When omitted, opens as a general games browser.
  username?: string;
  onClose: () => void;
}

export default function PlayerGamesModal({ username, onClose }: PlayerGamesModalProps) {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [tab, setTab] = useState<TabKey>('active');
  const [onlyThisPlayer, setOnlyThisPlayer] = useState<boolean>(!!username);

  const [active, setActive] = useState<GameSummary[]>([]);
  const [finished, setFinished] = useState<GameSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const effectiveUsername = onlyThisPlayer ? username : undefined;

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      getActiveRooms(effectiveUsername),
      listPublicGames(effectiveUsername),
    ])
      .then(([activeRows, completedRows]) => {
        setActive(activeRows as GameSummary[]);
        // listPublicGames may include in-progress games (server-side filter); we
        // only want truly finished ones here.
        setFinished((completedRows as GameSummary[]).filter(g => g.winner));
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [effectiveUsername]);

  const list = tab === 'active' ? active : finished;

  const title = useMemo(() => {
    if (username && onlyThisPlayer) return `${t.viewGamesBtn}: ${username}`;
    return t.gamesBrowser;
  }, [username, onlyThisPlayer, t]);

  const handleGameClick = (game: GameSummary) => {
    onClose();
    navigate(`/room/${game.id}?watch=1`);
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
          <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate pr-2">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">✕</button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1 p-2 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            type="button"
            onClick={() => setTab('active')}
            className={`py-1.5 text-sm font-semibold rounded-md transition-colors ${
              tab === 'active'
                ? 'bg-indigo-500 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {t.tabActive} ({active.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('finished')}
            className={`py-1.5 text-sm font-semibold rounded-md transition-colors ${
              tab === 'finished'
                ? 'bg-indigo-500 text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {t.tabFinished} ({finished.length})
          </button>
        </div>

        {/* Filter (only when opened from a profile) */}
        {username && (
          <div className="px-3 py-2 border-b dark:border-gray-700 text-xs flex items-center gap-2 bg-gray-50/50 dark:bg-gray-900/50">
            <span className="text-gray-500 dark:text-gray-400">{t.filter}:</span>
            <button
              type="button"
              onClick={() => setOnlyThisPlayer(true)}
              className={`px-2 py-1 rounded ${
                onlyThisPlayer
                  ? 'bg-indigo-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {username}
            </button>
            <button
              type="button"
              onClick={() => setOnlyThisPlayer(false)}
              className={`px-2 py-1 rounded ${
                !onlyThisPlayer
                  ? 'bg-indigo-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {t.allPlayers}
            </button>
          </div>
        )}

        <div className="p-4 overflow-y-auto flex-1">
          {isLoading ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">{t.loading}</p>
          ) : list.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">{t.noGames}</p>
          ) : (
            <div className="space-y-2">
              {list.map(game => (
                <button
                  key={game.id}
                  onClick={() => handleGameClick(game)}
                  className="w-full p-3 text-left bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                        {game.playerNames.player1} vs {game.playerNames.player2}
                        {tab === 'finished' && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            game.rated
                              ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                              : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                          }`}>
                            {game.rated ? t.lobbyRated : t.lobbyUnrated}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {t.moves}: {game.moveCount - 1}
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
