import { useState, useEffect, useCallback } from 'react';
import { getPlayers, PlayerInfo } from '../../db/authApi';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import OnlineIndicator from '../UI/OnlineIndicator';
import PlayerProfileModal from '../Auth/PlayerProfileModal';

// Compact online-players strip for the top of the chat column — a header count
// plus a horizontally-scrolling row of clickable name chips. Keeps the chat
// tall (the old vertical panel lived in the left column, now taken by ZERTZ TV).
export default function OnlinePlayersStrip() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const all = await getPlayers('rating', 'desc');
      setPlayers(all.filter(p => p.online && p.id !== user?.id));
    } catch {
      /* keep last list */
    }
  }, [user?.id]);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 15000);
    return () => clearInterval(iv);
  }, [refresh]);

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-md px-3 py-2 mb-3 flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex-shrink-0">
          {t.onlinePlayers} ({players.length})
        </span>
        {players.length === 0 ? (
          <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{t.noOneOnline}</span>
        ) : (
          <ul className="flex items-center gap-1 overflow-x-auto -mx-1 px-1" style={{ scrollbarWidth: 'thin' }}>
            {players.map(p => (
              <li key={p.id} className="flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  title={`${p.username} · ${p.rating}`}
                >
                  <OnlineIndicator online lastSeenMs={p.lastSeenMs} />
                  <span className="text-xs text-gray-800 dark:text-gray-100 max-w-[6rem] truncate">
                    {p.country && <span className="mr-0.5">{p.country}</span>}
                    {p.username}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedId != null && (
        <PlayerProfileModal
          playerId={selectedId}
          onClose={() => { setSelectedId(null); refresh(); }}
        />
      )}
    </div>
  );
}
