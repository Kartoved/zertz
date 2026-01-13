import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { WIN_CONDITIONS } from '../../game/types';

export default function GameStats() {
  const { state, playerNames } = useGameStore();
  
  const renderCaptures = (player: 'player1' | 'player2') => {
    const caps = state.captures[player];
    return (
      <div className="flex gap-2 items-center">
        <span className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-white border border-gray-300" />
          <span className={caps.white >= WIN_CONDITIONS.white ? 'text-green-500 font-bold' : ''}>
            {caps.white}/{WIN_CONDITIONS.white}
          </span>
        </span>
        <span className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-gray-400" />
          <span className={caps.gray >= WIN_CONDITIONS.gray ? 'text-green-500 font-bold' : ''}>
            {caps.gray}/{WIN_CONDITIONS.gray}
          </span>
        </span>
        <span className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-gray-800" />
          <span className={caps.black >= WIN_CONDITIONS.black ? 'text-green-500 font-bold' : ''}>
            {caps.black}/{WIN_CONDITIONS.black}
          </span>
        </span>
      </div>
    );
  };
  
  return (
    <div className="flex flex-col gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md">
      <div className={`flex justify-between items-center p-3 rounded-lg ${
        state.currentPlayer === 'player1' 
          ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500' 
          : 'bg-gray-50 dark:bg-gray-700'
      }`}>
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">
            {playerNames.player1}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Взятия:</div>
        </div>
        {renderCaptures('player1')}
      </div>
      
      <div className={`flex justify-between items-center p-3 rounded-lg ${
        state.currentPlayer === 'player2' 
          ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500' 
          : 'bg-gray-50 dark:bg-gray-700'
      }`}>
        <div>
          <div className="font-semibold text-gray-900 dark:text-white">
            {playerNames.player2}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Взятия:</div>
        </div>
        {renderCaptures('player2')}
      </div>
      
      <div className="text-center text-sm text-gray-600 dark:text-gray-400">
        Ход #{state.moveNumber} • {state.currentPlayer === 'player1' ? playerNames.player1 : playerNames.player2}
        {state.phase === 'ringRemoval' && ' • Удалите кольцо'}
      </div>
    </div>
  );
}
