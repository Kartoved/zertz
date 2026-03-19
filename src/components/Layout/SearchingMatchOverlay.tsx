interface SearchingMatchOverlayProps {
  onCancel: () => void;
  icon: string;
  boardSize: number;
  timeControlId: string;
}

export default function SearchingMatchOverlay({ onCancel, icon, boardSize, timeControlId }: SearchingMatchOverlayProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500/20">
          <div className="h-full bg-indigo-500 animate-[loading_2s_ease-in-out_infinite]" />
        </div>
        
        <div className="w-20 h-20 mx-auto bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-6">
          <span className="text-4xl animate-pulse">
            {icon}
          </span>
        </div>

        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Searching for opponent...
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-8">
          {boardSize} rings / {timeControlId}
        </p>

        <button
          onClick={onCancel}
          className="w-full py-3.5 px-6 rounded-xl font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
