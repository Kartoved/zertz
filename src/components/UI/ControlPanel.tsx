import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';

export default function ControlPanel() {
  const { undo, currentNode } = useGameStore();
  const { setScreen, openRules } = useUIStore();
  
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      <button
        onClick={undo}
        disabled={!currentNode.parent}
        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 
          dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors text-gray-800 dark:text-gray-200"
      >
        ↶ Отменить
      </button>
      
      <button
        onClick={() => setScreen('menu')}
        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 
          dark:hover:bg-gray-600 transition-colors text-gray-800 dark:text-gray-200"
      >
        ≡ Меню
      </button>

      <button
        onClick={openRules}
        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 
          dark:hover:bg-gray-600 transition-colors text-gray-800 dark:text-gray-200"
      >
        📘 Правила
      </button>
    </div>
  );
}
