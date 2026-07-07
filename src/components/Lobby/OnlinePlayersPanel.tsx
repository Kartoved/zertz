import { useState, useEffect, useCallback } from 'react';
import { getPlayers, PlayerInfo } from '../../db/authApi';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import OnlineIndicator from '../UI/OnlineIndicator';
import PlayerProfileModal from '../Auth/PlayerProfileModal';

// Left-column panel listing currently-online players (excluding self), sorted by
// rating. Clicking a row opens the player profile modal (challenge / follow).
// Presence comes from GET /api/players (each row carries an `online` flag derived
// from last_seen); we poll to keep it fresh.
export default function OnlinePlayersPanel() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const all = await getPlayers('rating', 'desc');
      setPlayers(all.filter(p => p.online && p.id !== user?.id));
    } catch {
      /* ignore transient errors — keep last list */
    }
  }, [user?.id]);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 15000);
    return () => clearInterval(iv);
  }, [refresh]);

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-md p-4">
      <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
        {t.onlinePlayers} ({players.length})
      </h2>

      {players.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-2">{t.noOneOnline}</p>
      ) : (
        <ul className="flex flex-col gap-0.5 max-h-[52vh] overflow-y-auto -mx-1">
          {players.map(p => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSelectedId(p.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
              >
                <OnlineIndicator online lastSeenMs={p.lastSeenMs} />
                <span className="text-sm text-gray-800 dark:text-gray-100 truncate flex-1 min-w-0">
                  <span className="mr-1">{p.country}</span>
                  {p.username}
                </span>
                <span className="text-xs font-semibold text-indigo-500 dark:text-indigo-300 flex-shrink-0">
                  {p.rating}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedId != null && (
        <PlayerProfileModal
          playerId={selectedId}
          onClose={() => { setSelectedId(null); refresh(); }}
        />
      )}
    </div>
  );
}
