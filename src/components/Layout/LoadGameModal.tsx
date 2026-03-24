import { useState, useEffect } from 'react';
import { useI18n, getWinTypeLabel } from '../../i18n';
import { listPublicGames } from '../../db/gamesApi';

type SavedGame = any;

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

interface LoadGameModalProps {
  savedGames: SavedGame[];
  boardLabels: Record<number, string>;
  onClose: () => void;
  onLoadGame: (gameId: string) => void;
}

export default function LoadGameModal({ savedGames, boardLabels, onClose, onLoadGame }: LoadGameModalProps) {
  const { t } = useI18n();
  const [loadTab, setLoadTab] = useState<'current' | 'completed' | 'archive'>('current');
  const [loadFilter, setLoadFilter] = useState<'all' | 'local' | 'online'>('all');
  const [archiveGames, setArchiveGames] = useState<SavedGame[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);

  useEffect(() => {
    if (loadTab === 'archive' && archiveGames.length === 0) {
      setArchiveLoading(true);
      listPublicGames()
        .then(setArchiveGames)
        .catch(() => {})
        .finally(() => setArchiveLoading(false));
    }
  }, [loadTab]);

  const currentGames = savedGames.filter(g => !g.winner);
  const completedGames = savedGames.filter(g => !!g.winner);
  const tabGames = loadTab === 'current' ? currentGames : completedGames;

  const filteredGames = loadFilter === 'all' ? tabGames
    : loadFilter === 'local' ? tabGames.filter((g: SavedGame) => !g.isOnline)
    : tabGames.filter((g: SavedGame) => g.isOnline);

  const renderWinner = (game: SavedGame) => {
    if (!game.winner) return t.inProgress;
    if (game.winner === 'cancelled') return t.cancelledStatus;
    return game.winner === 'player1' ? game.playerNames.player1 : game.playerNames.player2;
  };

  const winnerColor = (game: SavedGame) => {
    if (!game.winner) return 'text-yellow-600 dark:text-yellow-400';
    if (game.winner === 'cancelled') return 'text-gray-500 dark:text-gray-400';
    return 'text-green-600 dark:text-green-400';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t.loadGame}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>
        {/* Tabs */}
        <div className="flex border-b dark:border-gray-700">
          <button
            onClick={() => setLoadTab('current')}
            className={`flex-1 py-2 px-3 text-center text-sm font-semibold transition-colors ${
              loadTab === 'current'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}
          >
            {t.loadCurrent} ({currentGames.length})
          </button>
          <button
            onClick={() => setLoadTab('completed')}
            className={`flex-1 py-2 px-3 text-center text-sm font-semibold transition-colors ${
              loadTab === 'completed'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}
          >
            {t.loadCompleted} ({completedGames.length})
          </button>
          <button
            onClick={() => setLoadTab('archive')}
            className={`flex-1 py-2 px-3 text-center text-sm font-semibold transition-colors ${
              loadTab === 'archive'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
            }`}
          >
            {t.loadArchive}
          </button>
        </div>

        {loadTab !== 'archive' && (
          <div className="flex gap-1 px-4 pt-3">
            {(['all', 'local', 'online'] as const).map(f => (
              <button
                key={f}
                onClick={() => setLoadFilter(f)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  loadFilter === f
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                }`}
              >
                {f === 'all' ? t.filterAll : f === 'local' ? t.filterLocal : t.filterOnline}
              </button>
            ))}
          </div>
        )}

        <div className="p-4 overflow-y-auto max-h-96">
          {loadTab === 'archive' ? (
            archiveLoading ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">{t.loading}</p>
            ) : archiveGames.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">{t.noGames}</p>
            ) : (
              <div className="space-y-2">
                {archiveGames.map(game => (
                  <button
                    key={game.id}
                    onClick={() => onLoadGame(String(game.id))}
                    className="w-full p-3 text-left bg-gray-100 dark:bg-gray-700 hover:bg-gray-200
                      dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {game.playerNames.player1} vs {game.playerNames.player2}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {t.moves}: {game.moveCount} • {t.board}: {boardLabels[game.boardSize] ?? `${game.boardSize}`}
                        </div>
                        {game.winType && game.winner !== 'cancelled' && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {getWinTypeLabel(t, game.winType)}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-medium ${winnerColor(game)}`}>
                          {renderWinner(game)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {formatDate(game.updatedAt)}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : filteredGames.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              {t.noGames}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredGames.map((game: SavedGame) => (
                <button
                  key={game.id}
                  onClick={() => onLoadGame(game.id)}
                  className="w-full p-3 text-left bg-gray-100 dark:bg-gray-700 hover:bg-gray-200
                    dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        {game.playerNames.player1} vs {game.playerNames.player2}
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          game.isOnline
                            ? 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300'
                            : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                        }`}>
                          {game.isOnline ? t.onlineLabel : t.localLabel}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {t.moves}: {game.moveCount} • {t.board}: {boardLabels[game.boardSize] ?? `${game.boardSize}`}
                      </div>
                      {game.winType && game.winner !== 'cancelled' && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {getWinTypeLabel(t, game.winType)}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${winnerColor(game)}`}>
                        {renderWinner(game)}
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
  );
}
