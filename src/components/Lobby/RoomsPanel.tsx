import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { useAuthStore } from '../../store/authStore';
import { getPendingRooms, deleteRoom, PendingRoom } from '../../db/roomsApi';
import { TIME_CONTROLS } from '../Layout/MainMenu';

interface RoomsPanelProps {
  onCreateGame: () => void;
  currentGames: any[];
  onLoadGame: (gameId: string) => void;
}

function formatTimeControl(baseMs: number | null, incMs: number | null): string {
  if (!baseMs) return '∞';
  const mins = Math.round(baseMs / 60000);
  if (incMs === -1) return `${mins}d`;
  const inc = Math.round((incMs || 0) / 1000);
  return `${mins}+${inc}`;
}

function timeIcon(baseMs: number | null, incMs: number | null): string {
  if (incMs === -1) return '∞';
  const mins = baseMs ? baseMs / 60000 : 0;
  if (mins >= 30) return TIME_CONTROLS.find(c => c.id === 'long')?.icon ?? '⏳';
  if (mins >= 15) return TIME_CONTROLS.find(c => c.id === 'rapid')?.icon ?? '🏇';
  return TIME_CONTROLS.find(c => c.id === 'blitz')?.icon ?? '⚡';
}

export default function RoomsPanel({ onCreateGame, currentGames, onLoadGame }: RoomsPanelProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [pendingRooms, setPendingRooms] = useState<PendingRoom[]>([]);
  const [copiedRoomId, setCopiedRoomId] = useState<number | null>(null);

  const fetchRooms = useCallback(async () => {
    if (!user) { setPendingRooms([]); return; }
    try {
      const rooms = await getPendingRooms();
      setPendingRooms(rooms);
    } catch {
      /* ignore */
    }
  }, [user]);

  useEffect(() => {
    fetchRooms();
    const id = setInterval(fetchRooms, 5000);
    return () => clearInterval(id);
  }, [fetchRooms]);

  const handleCopy = useCallback((roomId: number) => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`);
    setCopiedRoomId(roomId);
    setTimeout(() => setCopiedRoomId(id => id === roomId ? null : id), 1800);
  }, []);

  const handleCancel = useCallback(async (roomId: number) => {
    try {
      await deleteRoom(roomId);
      setPendingRooms(rs => rs.filter(r => r.id !== roomId));
    } catch {
      /* ignore */
    }
  }, []);

  const onlineCurrent = currentGames.filter(g => g.isOnline);

  return (
    <div className="flex flex-col gap-3 mt-6">
      {/* Create game */}
      <button
        type="button"
        disabled={!user}
        onClick={() => user && onCreateGame()}
        className={`w-full py-3.5 px-3 rounded-xl font-bold sm:text-lg text-base transition-all shadow-md
          ${user
            ? 'hover:shadow-lg active:scale-95 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white'
            : 'opacity-50 cursor-not-allowed bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
          }`}
      >
        + {t.createGame}
      </button>

      {!user && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          🔒 {t.onlineRequiresAuth}
        </p>
      )}

      {/* Waiting slots (my pending rooms) */}
      {pendingRooms.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {t.lobbyWaiting}
          </p>
          {pendingRooms.map(room => (
            <div
              key={room.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 font-mono">{room.boardSize}</span>
                  <span className="text-xs">
                    {timeIcon(room.timeControlBaseMs, room.timeControlIncrementMs)} {formatTimeControl(room.timeControlBaseMs, room.timeControlIncrementMs)}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${room.rated ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400'}`}>
                    {room.rated ? t.lobbyRated : t.lobbyUnrated}
                  </span>
                </div>
                <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">
                  {t.lobbyWaiting}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleCopy(room.id)}
                  title={t.copyLink}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors border border-gray-200 dark:border-gray-600"
                >
                  {copiedRoomId === room.id ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  )}
                </button>
                <button
                  onClick={() => navigate(`/room/${room.id}`)}
                  title={t.goToGame}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors border border-gray-200 dark:border-gray-600"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
                <button
                  onClick={() => handleCancel(room.id)}
                  title={t.lobbyCancel}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-colors border border-red-200 dark:border-red-800"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Current non-async games (online in-progress) */}
      {onlineCurrent.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {t.loadCurrent} ({onlineCurrent.length})
          </p>
          {onlineCurrent.map(game => {
            let isMyTurn = false;
            if (user) {
              const isPlayer1 = game.playerNames.player1 === user.username;
              const isPlayer2 = game.playerNames.player2 === user.username;
              const isPlayer1Turn = game.moveCount % 2 === 1;
              isMyTurn = (isPlayer1 && isPlayer1Turn) || (isPlayer2 && !isPlayer1Turn);
            }
            return (
              <button
                key={game.id}
                onClick={() => onLoadGame(game.id)}
                className="w-full px-4 py-3 text-left rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-100">
                      <span className="truncate">{game.playerNames.player1}</span>
                      <span className="text-gray-400 text-xs font-normal">vs</span>
                      <span className="truncate">{game.playerNames.player2}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300">
                        {t.onlineLabel}
                      </span>
                      {isMyTurn && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-300">
                          {t.yourTurn}
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400 ml-auto">
                        {game.moveCount} {t.moves.toLowerCase()}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {user && pendingRooms.length === 0 && onlineCurrent.length === 0 && (
        <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-8">
          {t.lobbyEmpty}
        </p>
      )}
    </div>
  );
}
