import { MarbleColor } from '../../game/types';
import { useGameStore } from '../../store/gameStore';
import { hasAvailableCaptures } from '../../game/GameEngine';

export default function MarbleSelector() {
  const { state, selectedMarbleColor, selectMarbleColor } = useGameStore();
  
  const mustCapture = hasAvailableCaptures(state);
  const isDisabled = state.phase !== 'placement' || mustCapture;

  const reserveTotal = state.reserve.white + state.reserve.gray + state.reserve.black;
  const sourceCounts = reserveTotal > 0 ? state.reserve : state.captures[state.currentPlayer];
  
  const marbles: { color: MarbleColor; count: number; label: string }[] = [
    { color: 'white', count: sourceCounts.white, label: 'Белые' },
    { color: 'gray', count: sourceCounts.gray, label: 'Серые' },
    { color: 'black', count: sourceCounts.black, label: 'Чёрные' },
  ];
  
  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
        {mustCapture ? 'Обязательное взятие!' : 'Выберите шарик:'}
      </div>
      <div className="flex gap-3">
        {marbles.map(({ color, count }) => (
          <button
            key={color}
            onClick={() => !isDisabled && count > 0 && selectMarbleColor(color)}
            disabled={isDisabled || count === 0}
            className={`
              flex flex-col items-center gap-1 p-2 rounded-lg transition-all
              ${selectedMarbleColor === color 
                ? 'bg-blue-100 dark:bg-blue-900 ring-2 ring-blue-500' 
                : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}
              ${(isDisabled || count === 0) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div
              className={`
                w-8 h-8 rounded-full border-2
                ${color === 'white' ? 'bg-white border-gray-300' : ''}
                ${color === 'gray' ? 'bg-gray-400 border-gray-500' : ''}
                ${color === 'black' ? 'bg-gray-700 border-gray-800' : ''}
              `}
              style={{
                background: color === 'white' 
                  ? 'radial-gradient(circle at 30% 30%, #ffffff, #e0e0e0)'
                  : color === 'gray'
                  ? 'radial-gradient(circle at 30% 30%, #9ca3af, #6b7280)'
                  : 'radial-gradient(circle at 30% 30%, #6b7280, #374151)',
              }}
            />
            <span className="text-xs font-medium dark:text-gray-300">
              {count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
