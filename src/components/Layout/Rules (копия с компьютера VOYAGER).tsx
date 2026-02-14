import { useUIStore } from '../../store/uiStore';
import RulesContent from '../UI/RulesContent';

export default function Rules() {
  const { setScreen, previousScreen } = useUIStore();
  
  return (
    <div className="min-h-screen p-6 bg-gray-100 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => setScreen(previousScreen)}
          className="mb-6 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg 
            hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors
            text-gray-800 dark:text-white"
        >
          ← Назад
        </button>
        
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Правила игры ZERTZ
        </h1>
        
        <RulesContent />
      </div>
    </div>
  );
}
