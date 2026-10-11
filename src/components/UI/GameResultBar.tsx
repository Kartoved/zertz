import type { ReactNode } from 'react';

interface GameResultBarProps {
  /** Annulled / aborted game — no winner. */
  cancelled: boolean;
  title: string;
  subtitle?: string;
  /** Optional buttons (rematch, menu…) shown on the right. */
  actions?: ReactNode;
}

// Non-modal game-over banner shown right above the board (Lichess-style): the
// result is visible at a glance, nothing to dismiss, the board stays usable.
export default function GameResultBar({ cancelled, title, subtitle, actions }: GameResultBarProps) {
  return (
    <div
      role="status"
      className={`mx-3 mt-1 mb-1 px-3 py-2 rounded-lg border flex flex-wrap items-center gap-x-3 gap-y-2 animate-[fadeInScale_200ms_ease-out] ${
        cancelled
          ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
          : 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className={`font-bold text-sm sm:text-base truncate ${cancelled ? 'text-gray-600 dark:text-gray-300' : 'text-green-800 dark:text-green-200'}`}>
          {cancelled ? '✕' : '🏆'} {title}
        </div>
        {subtitle && <div className="text-xs text-gray-600 dark:text-gray-400 truncate">{subtitle}</div>}
      </div>
      {actions && <div className="flex gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
