import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import CountryBadge from './CountryBadge';
import { normalizeCountryValue } from '../../utils/country';

interface PlayerProfileCardProps {
  onLoginClick: () => void;
  onProfileClick: () => void;
}

export default function PlayerProfileCard({ onLoginClick, onProfileClick }: PlayerProfileCardProps) {
  const { t } = useI18n();
  const { user } = useAuthStore();

  if (!user) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-5 flex flex-col items-center justify-center h-full">
        <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mb-3">
          <span className="text-2xl text-gray-400">?</span>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">{t.guest}</p>
        <button
          onClick={onLoginClick}
          className="w-full py-2.5 px-4 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold
            rounded-xl shadow-md hover:shadow-lg transition-all text-sm"
        >
          {t.loginRegister}
        </button>
      </div>
    );
  }

  const country = normalizeCountryValue(user.country || '');
  const games = user.wins + user.losses;
  const winrate = games > 0 ? Math.round((user.wins / games) * 100) : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-5 flex flex-col h-full">
      {/* Avatar + name */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
          {user.username.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <button
            onClick={onProfileClick}
            className="font-bold text-gray-900 dark:text-white hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors truncate block text-left"
          >
            <CountryBadge country={country} size={16} className="mr-1.5" />
            {user.username}
          </button>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {t.rating}: {Math.round(user.rating)}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-2.5 text-center">
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{Math.round(user.rating)}</div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t.rating}</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-2.5 text-center">
          <div className="text-lg font-bold text-gray-900 dark:text-white">{games}</div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t.games}</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-2.5 text-center">
          <div className="text-sm font-bold">
            <span className="text-green-600">{user.wins}</span>
            <span className="text-gray-400 mx-0.5">/</span>
            <span className="text-red-500">{user.losses}</span>
          </div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t.winsLosses}</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-2.5 text-center">
          <div className="text-sm font-bold text-gray-900 dark:text-white">{winrate}%</div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t.winrate}</div>
        </div>
      </div>

      {/* Best streak */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-2.5 text-center mb-4">
        <div className="text-lg font-bold text-orange-500">{user.bestStreak}</div>
        <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t.bestStreak}</div>
      </div>

      {/* Quote */}
      {user.quote && (
        <div className="text-xs text-gray-500 dark:text-gray-400 italic border-t dark:border-gray-700 pt-3 mt-auto">
          "{user.quote}"
        </div>
      )}

      {/* Profile button */}
      <button
        onClick={onProfileClick}
        className="mt-auto w-full py-2 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200
          dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium
          rounded-xl transition-colors text-sm"
      >
        {t.profile}
      </button>
    </div>
  );
}
