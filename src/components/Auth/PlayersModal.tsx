import { useState, useEffect } from 'react';
import { getPlayers, PlayerInfo } from '../../db/authApi';

interface PlayersModalProps {
  onClose: () => void;
}

type SortKey = 'rating' | 'wins' | 'losses' | 'username' | 'created_at';

const COLUMN_HEADERS: { key: SortKey | 'games' | 'winrate'; label: string; sortKey?: SortKey }[] = [
  { key: 'username', label: 'Игрок', sortKey: 'username' },
  { key: 'rating', label: 'Рейтинг', sortKey: 'rating' },
  { key: 'games', label: 'Игр' },
  { key: 'wins', label: 'Побед', sortKey: 'wins' },
  { key: 'losses', label: 'Поражений', sortKey: 'losses' },
  { key: 'winrate', label: 'Винрейт' },
  { key: 'created_at', label: 'Регистрация', sortKey: 'created_at' },
];

export default function PlayersModal({ onClose }: PlayersModalProps) {
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('rating');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadPlayers();
  }, [sortKey, sortOrder]);

  const loadPlayers = async () => {
    setIsLoading(true);
    try {
      const data = await getPlayers(sortKey, sortOrder);
      setPlayers(data);
    } catch {
      // ignore
    }
    setIsLoading(false);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder(key === 'username' || key === 'created_at' ? 'asc' : 'desc');
    }
  };

  const getSortArrow = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortOrder === 'asc' ? ' ▲' : ' ▼';
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Игроки</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">Загрузка...</div>
          ) : players.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">Нет зарегистрированных игроков</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-600 dark:text-gray-300 font-medium">#</th>
                  {COLUMN_HEADERS.map((col) => (
                    <th
                      key={col.key}
                      className={`px-3 py-2 text-left text-gray-600 dark:text-gray-300 font-medium ${
                        col.sortKey ? 'cursor-pointer hover:text-blue-500 select-none' : ''
                      }`}
                      onClick={() => col.sortKey && handleSort(col.sortKey)}
                    >
                      {col.label}{col.sortKey ? getSortArrow(col.sortKey) : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.map((p, i) => (
                  <tr
                    key={p.id}
                    className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750"
                  >
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                      {p.country} {p.username}
                    </td>
                    <td className="px-3 py-2 font-bold text-blue-600 dark:text-blue-400">{p.rating}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{p.games}</td>
                    <td className="px-3 py-2 text-green-600">{p.wins}</td>
                    <td className="px-3 py-2 text-red-500">{p.losses}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{p.winrate}%</td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{formatDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
