import { useState, useEffect } from 'react';
import { getPlayers, getFollowing, getFollowIds, followUser, unfollowUser, PlayerInfo } from '../../db/authApi';
import { useAuthStore } from '../../store/authStore';
import PlayerProfileModal from './PlayerProfileModal';
import CountryBadge from '../UI/CountryBadge';

interface PlayersModalProps {
  onClose: () => void;
}

type SortKey = 'rating' | 'wins' | 'losses' | 'username' | 'created_at' | 'games' | 'winrate';
type Tab = 'all' | 'friends';

const COLUMN_HEADERS: { key: SortKey | 'games' | 'winrate' | 'action'; label: string; sortKey?: SortKey }[] = [
  { key: 'username', label: 'Игрок', sortKey: 'username' },
  { key: 'rating', label: 'Рейтинг', sortKey: 'rating' },
  { key: 'games', label: 'Игр', sortKey: 'games' },
  { key: 'wins', label: 'Побед', sortKey: 'wins' },
  { key: 'losses', label: 'Пораж.', sortKey: 'losses' },
  { key: 'winrate', label: '%', sortKey: 'winrate' },
  { key: 'created_at', label: 'Рег.', sortKey: 'created_at' },
  { key: 'action', label: '' },
];

export default function PlayersModal({ onClose }: PlayersModalProps) {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('all');
  const [allPlayers, setAllPlayers] = useState<PlayerInfo[]>([]);
  const [friends, setFriends] = useState<PlayerInfo[]>([]);
  const [followIds, setFollowIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('rating');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    loadData();
  }, [sortKey, sortOrder, tab]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (tab === 'all') {
        const data = await getPlayers(sortKey, sortOrder);
        setAllPlayers(data);
      } else {
        const data = await getFollowing();
        setFriends(data);
      }
      if (user) {
        const ids = await getFollowIds();
        setFollowIds(new Set(ids));
      }
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
    return new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleFollow = async (playerId: number) => {
    try {
      if (followIds.has(playerId)) {
        await unfollowUser(playerId);
        setFollowIds(prev => { const n = new Set(prev); n.delete(playerId); return n; });
        setFriends(prev => prev.filter(p => p.id !== playerId));
        showToast('Отписка оформлена');
      } else {
        await followUser(playerId);
        setFollowIds(prev => new Set(prev).add(playerId));
        showToast('Подписка оформлена');
      }
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const players = tab === 'all' ? allPlayers : friends;
  const filtered = search.trim()
    ? players.filter(p => p.username.toLowerCase().includes(search.trim().toLowerCase()))
    : players;

  const sorted = [...filtered].sort((a, b) => {
    const direction = sortOrder === 'asc' ? 1 : -1;

    if (sortKey === 'username') {
      return a.username.localeCompare(b.username, 'ru') * direction;
    }
    if (sortKey === 'created_at') {
      return (a.createdAt - b.createdAt) * direction;
    }
    if (sortKey === 'games') {
      return (a.games - b.games) * direction;
    }
    if (sortKey === 'winrate') {
      return (a.winrate - b.winrate) * direction;
    }
    return ((a[sortKey] as number) - (b[sortKey] as number)) * direction;
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b dark:border-gray-700">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Игроки</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">✕</button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-3">
            <button
              onClick={() => setTab('all')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              Все игроки
            </button>
            {user && (
              <button
                onClick={() => setTab('friends')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === 'friends' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                Друзья
              </button>
            )}
          </div>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по нику..."
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg
              bg-white dark:bg-gray-700 text-gray-900 dark:text-white
              focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">Загрузка...</div>
          ) : sorted.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              {tab === 'friends' ? 'Нет подписок' : 'Нет игроков'}
            </div>
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
                {sorted.map((p, i) => (
                  <tr
                    key={p.id}
                    className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750"
                  >
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => setSelectedPlayerId(p.id)}
                        className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <CountryBadge country={p.country} className="mr-2" />
                        {p.username}
                      </button>
                    </td>
                    <td className="px-3 py-2 font-bold text-blue-600 dark:text-blue-400">{p.rating}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{p.games}</td>
                    <td className="px-3 py-2 text-green-600">{p.wins}</td>
                    <td className="px-3 py-2 text-red-500">{p.losses}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{p.winrate}%</td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{formatDate(p.createdAt)}</td>
                    <td className="px-3 py-2">
                      {user && user.id !== p.id && (
                        <button
                          onClick={() => handleFollow(p.id)}
                          className={`text-xs px-2 py-1 rounded transition-colors ${
                            followIds.has(p.id)
                              ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-red-100 hover:text-red-600'
                              : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200'
                          }`}
                        >
                          {followIds.has(p.id) ? '✓' : '+'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm text-center">
            {toast}
          </div>
        )}
      </div>

      {/* Player Profile Modal */}
      {selectedPlayerId && (
        <PlayerProfileModal
          playerId={selectedPlayerId}
          onClose={() => { setSelectedPlayerId(null); loadData(); }}
        />
      )}
    </div>
  );
}
