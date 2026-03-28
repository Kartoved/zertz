import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { WIN_CONDITIONS } from '../../game/types';
import { useI18n } from '../../i18n';

interface GameStatsProps {
  compact?: boolean;
  hideLabels?: boolean;
}

export default function GameStats({ compact = false, hideLabels = false }: GameStatsProps) {
  const { t } = useI18n();
  const { state, playerNames, setPlayerNames } = useGameStore();
  const [editingPlayer, setEditingPlayer] = useState<'player1' | 'player2' | null>(null);
  const [draftName, setDraftName] = useState('');

  const startEdit = (player: 'player1' | 'player2') => {
    setEditingPlayer(player);
    setDraftName(playerNames[player]);
  };

  const commitName = () => {
    if (!editingPlayer) return;
    const trimmed = draftName.trim();
    const nextName = trimmed.length > 0 ? trimmed : playerNames[editingPlayer];
    if (editingPlayer === 'player1') {
      setPlayerNames(nextName, playerNames.player2);
    } else {
      setPlayerNames(playerNames.player1, nextName);
    }
    setEditingPlayer(null);
  };
  
  const renderCaptures = (player: 'player1' | 'player2') => {
    const caps = state.captures[player];
    const marbleClass = (compact && !hideLabels) ? 'w-3 h-3' : 'w-4 h-4';
    const textClass = (compact && !hideLabels) ? 'text-xs' : '';
    const containerFlex = hideLabels ? 'flex-1 justify-center' : '';
    return (
      <div className={`flex gap-3 items-center ${containerFlex}`}>
        <span className={`flex items-center gap-1.5 ${textClass}`}>
          <div className={`${marbleClass} rounded-full bg-white border border-gray-300 shadow-sm`} />
          <span className={caps.white >= WIN_CONDITIONS.white ? 'text-green-500 font-bold' : 'text-gray-800 dark:text-gray-200'}>
            {caps.white}
          </span>
        </span>
        <span className={`flex items-center gap-1.5 ${textClass}`}>
          <div className={`${marbleClass} rounded-full bg-gray-400 shadow-sm`} />
          <span className={caps.gray >= WIN_CONDITIONS.gray ? 'text-green-500 font-bold' : 'text-gray-800 dark:text-gray-200'}>
            {caps.gray}
          </span>
        </span>
        <span className={`flex items-center gap-1.5 ${textClass}`}>
          <div className={`${marbleClass} rounded-full bg-gray-700 shadow-sm`} />
          <span className={caps.black >= WIN_CONDITIONS.black ? 'text-green-500 font-bold' : 'text-gray-800 dark:text-gray-200'}>
            {caps.black}
          </span>
        </span>
      </div>
    );
  };

  const containerClass = hideLabels
    ? 'flex gap-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm'
    : 'grid grid-cols-2 lg:grid-cols-1 gap-2 p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm';

  const cardClass = (active: boolean) => {
    const base = hideLabels
      ? 'flex justify-center items-center py-4 rounded-xl min-w-0'
      : 'flex flex-col gap-1 p-2 rounded-lg min-w-0';
    const activeClass = 'bg-blue-50 dark:bg-blue-900/40 ring-2 ring-blue-500 shadow-sm';
    const idleClass = 'bg-gray-50 dark:bg-gray-700/50';
    return `${base} ${active ? activeClass : idleClass} transition-all duration-200`;
  };

  const nameClass = 'text-sm font-semibold text-gray-900 dark:text-white truncate';
  const captionClass = 'text-[11px] text-gray-500 dark:text-gray-400';

  return (
    <div className={containerClass}>
      <div className={cardClass(state.currentPlayer === 'player1')}>
        {!hideLabels && (
          <div>
            <div className={nameClass} onDoubleClick={() => startEdit('player1')}>
              {editingPlayer === 'player1' ? (
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={(e) => { 
                    if (e.key === 'Enter') {
                      commitName();
                    }
                  }}
                  autoFocus
                  className="w-36 bg-white dark:bg-gray-700 rounded px-2 py-1 text-sm text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600"
                />
              ) : (
                playerNames.player1
              )}
            </div>
            <div className={captionClass}>{t.capturedMarbles}</div>
          </div>
        )}
        {renderCaptures('player1')}
      </div>
      
      <div className={cardClass(state.currentPlayer === 'player2')}>
        {!hideLabels && (
          <div>
            <div className={nameClass} onDoubleClick={() => startEdit('player2')}>
              {editingPlayer === 'player2' ? (
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commitName();
                    }
                  }}
                  autoFocus
                  className="w-36 bg-white dark:bg-gray-700 rounded px-2 py-1 text-sm text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600"
                />
              ) : (
                playerNames.player2
              )}
            </div>
            <div className={captionClass}>{t.capturedMarbles}</div>
          </div>
        )}
        {renderCaptures('player2')}
      </div>
    </div>
  );
}
