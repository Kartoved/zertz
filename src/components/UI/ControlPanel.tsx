import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { useI18n } from '../../i18n';

interface ControlPanelProps {
  onSurrender?: () => void;
}

export default function ControlPanel({ onSurrender }: ControlPanelProps) {
  const { t } = useI18n();
  const { undo, currentNode } = useGameStore();
  const { setScreen } = useUIStore();

  const handleSurrender = () => {
    if (onSurrender) {
      onSurrender();
      return;
    }
    setScreen('menu');
  };
  
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      <button
        onClick={undo}
        disabled={!currentNode.parent}
        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 
          dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors text-gray-800 dark:text-gray-200"
      >
        ↶ {t.undo}
      </button>
      
      <button
        onClick={handleSurrender}
        className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors text-white"
      >
        🏳️ {t.surrender}
      </button>
    </div>
  );
}
