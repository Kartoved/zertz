import { useI18n } from '../../i18n';

interface BoardSelectionModalProps {
  onClose: () => void;
  onSelectBoard: (boardSize: 37 | 48 | 61) => void;
}

export default function BoardSelectionModal({ onClose, onSelectBoard }: BoardSelectionModalProps) {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t.chooseBoard}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>
        <div className="p-4 space-y-3">
          <button
            onClick={() => onSelectBoard(37)}
            className="w-full p-3 text-left bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 
              dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            {t.board37}
          </button>
          <button
            onClick={() => onSelectBoard(48)}
            className="w-full p-3 text-left bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 
              dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            {t.board48}
          </button>
          <button
            onClick={() => onSelectBoard(61)}
            className="w-full p-3 text-left bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 
              dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            {t.board61}
          </button>
        </div>
      </div>
    </div>
  );
}
