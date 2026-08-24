import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import HexBoard from '../Board/HexBoard';
import { deserializeState } from '../../db/apiClient';
import { usePressToActivate } from '../../utils/pressToActivate';
import { useI18n } from '../../i18n';
import { TournamentLiveGame } from '../../db/tournamentApi';

function LiveGameCard({ game }: { game: TournamentLiveGame }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const state = useMemo(() => {
    try { return deserializeState(game.stateJson); } catch { return null; }
  }, [game.stateJson]);

  // Robust open-on-press: the board re-renders every poll, so a plain onClick can
  // be dropped when the element updates between press and release (see LiveGamesTV).
  const open = usePressToActivate(() => navigate(`/room/${game.roomId}?watch=1`));

  const Player = ({ side }: { side: 'player1' | 'player2' }) => (
    <span className="flex items-center gap-1 min-w-0">
      {game.berserk[side] && <span title="berserk">⚡</span>}
      <span className="truncate">{game.playerNames[side]}</span>
      {game.ratings[side] != null && <span className="text-gray-400">({game.ratings[side]})</span>}
    </span>
  );

  return (
    <button
      type="button"
      {...open}
      title={t.arenaWatch}
      style={{ touchAction: 'manipulation' }}
      className="flex flex-col rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
    >
      <div className="w-full aspect-square" style={{ pointerEvents: 'none' }}>
        {state && <HexBoard state={state} preview />}
      </div>
      <div className="px-2 py-1.5 text-[11px] text-gray-600 dark:text-gray-300 space-y-0.5">
        <Player side="player1" />
        <Player side="player2" />
      </div>
    </button>
  );
}

export default function TournamentLiveGames({ games }: { games: TournamentLiveGame[] }) {
  const { t } = useI18n();
  if (games.length === 0) return null;
  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2 flex items-center gap-1.5">
        {t.arenaLiveGames}
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {games.map(g => <LiveGameCard key={g.roomId} game={g} />)}
      </div>
    </div>
  );
}
