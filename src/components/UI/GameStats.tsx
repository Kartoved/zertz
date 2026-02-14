import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { WIN_CONDITIONS } from '../../game/types';
import { useI18n } from '../../i18n';

interface GameStatsProps {
  compact?: boolean;
}

export default function GameStats({ compact = false }: GameStatsProps) {
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
    const marbleClass = compact ? 'w-3 h-3' : 'w-4 h-4';
    const textClass = compact ? 'text-xs' : '';
    return (
      <div className="flex gap-2 items-center">
        <span className={`flex items-center gap-1 ${textClass}`}>
          <div className={`${marbleClass} rounded-full bg-white border border-gray-300`} />
          <span className={caps.white >= WIN_CONDITIONS.white ? 'text-green-500 font-bold' : ''}>
            {caps.white}
          </span>
        </span>
        <span className={`flex items-center gap-1 ${textClass}`}>
          <div className={`${marbleClass} rounded-full bg-gray-400`} />
          <span className={caps.gray >= WIN_CONDITIONS.gray ? 'text-green-500 font-bold' : ''}>
            {caps.gray}
          </span>
        </span>
        <span className={`flex items-center gap-1 ${textClass}`}>
          <div className={`${marbleClass} rounded-full bg-gray-700`} />
          <span className={caps.black >= WIN_CONDITIONS.black ? 'text-green-500 font-bold' : ''}>
            {caps.black}
          </span>
        </span>
      </div>
    );
  };

  const containerClass = compact
    ? 'flex flex-col gap-2 p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm'
    : 'flex flex-col gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md';

  const cardClass = (active: boolean) => {
    const base = compact ? 'flex justify-between items-center p-2 rounded-lg' : 'flex justify-between items-center p-3 rounded-lg';
    const activeClass = 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500';
    const idleClass = 'bg-gray-50 dark:bg-gray-700';
    return `${base} ${active ? activeClass : idleClass}`;
  };

  const nameClass = compact ? 'text-sm font-semibold text-gray-900 dark:text-white' : 'font-semibold text-gray-900 dark:text-white';
  const captionClass = compact ? 'text-[11px] text-gray-500 dark:text-gray-400' : 'text-sm text-gray-500 dark:text-gray-400';

  return (
    <div className={containerClass}>
      <div className={cardClass(state.currentPlayer === 'player1')}>
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
        {renderCaptures('player1')}
      </div>
      
      <div className={cardClass(state.currentPlayer === 'player2')}>
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
        {renderCaptures('player2')}
      </div>
      
      {!compact && (
        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
          {t.move} #{state.moveNumber} • {state.currentPlayer === 'player1' ? playerNames.player1 : playerNames.player2}
          {state.phase === 'ringRemoval' && ` • ${t.removeRing}`}
        </div>
      )}
    </div>
  );
}
