import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';

const COUNTRIES = [
  { emoji: '🌍', name: 'Земля' },
  { emoji: '🟢', name: 'Эсперантия' },
  { emoji: '🇷🇺', name: 'Россия' },
  { emoji: '🇺🇦', name: 'Украина' },
  { emoji: '🇧🇾', name: 'Беларусь' },
  { emoji: '🇰🇿', name: 'Казахстан' },
  { emoji: '🇺🇿', name: 'Узбекистан' },
  { emoji: '🇬🇪', name: 'Грузия' },
  { emoji: '🇦🇲', name: 'Армения' },
  { emoji: '🇦🇿', name: 'Азербайджан' },
  { emoji: '🇲🇩', name: 'Молдова' },
  { emoji: '🇺🇸', name: 'США' },
  { emoji: '🇬🇧', name: 'Великобритания' },
  { emoji: '🇩🇪', name: 'Германия' },
  { emoji: '🇫🇷', name: 'Франция' },
  { emoji: '🇪🇸', name: 'Испания' },
  { emoji: '🇮🇹', name: 'Италия' },
  { emoji: '🇵🇱', name: 'Польша' },
  { emoji: '🇳🇱', name: 'Нидерланды' },
  { emoji: '🇧🇪', name: 'Бельгия' },
  { emoji: '🇨🇿', name: 'Чехия' },
  { emoji: '🇦🇹', name: 'Австрия' },
  { emoji: '🇨🇭', name: 'Швейцария' },
  { emoji: '🇸🇪', name: 'Швеция' },
  { emoji: '🇳🇴', name: 'Норвегия' },
  { emoji: '🇫🇮', name: 'Финляндия' },
  { emoji: '🇩🇰', name: 'Дания' },
  { emoji: '🇵🇹', name: 'Португалия' },
  { emoji: '🇬🇷', name: 'Греция' },
  { emoji: '🇹🇷', name: 'Турция' },
  { emoji: '🇯🇵', name: 'Япония' },
  { emoji: '🇰🇷', name: 'Южная Корея' },
  { emoji: '🇨🇳', name: 'Китай' },
  { emoji: '🇮🇳', name: 'Индия' },
  { emoji: '🇧🇷', name: 'Бразилия' },
  { emoji: '🇦🇷', name: 'Аргентина' },
  { emoji: '🇲🇽', name: 'Мексика' },
  { emoji: '🇨🇦', name: 'Канада' },
  { emoji: '🇦🇺', name: 'Австралия' },
  { emoji: '🇮🇱', name: 'Израиль' },
  { emoji: '🇪🇬', name: 'Египет' },
  { emoji: '🇿🇦', name: 'ЮАР' },
];

const SPECIAL_CHARS = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;

interface ProfileModalProps {
  onClose: () => void;
}

export default function ProfileModal({ onClose }: ProfileModalProps) {
  const { user, updateProfile, logout, isLoading } = useAuthStore();
  const [quote, setQuote] = useState(user?.quote || '');
  const [country, setCountry] = useState(user?.country || '🌍');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [localError, setLocalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!user) return null;

  const games = user.wins + user.losses;
  const winrate = games > 0 ? Math.round((user.wins / games) * 100) : 0;

  const handleSaveProfile = async () => {
    setLocalError('');
    setSuccessMsg('');
    try {
      await updateProfile({ quote, country });
      setSuccessMsg('Профиль обновлён');
      setTimeout(() => setSuccessMsg(''), 2000);
    } catch (err: any) {
      setLocalError(err.message);
    }
  };

  const handleChangePassword = async () => {
    setLocalError('');
    setSuccessMsg('');
    if (!oldPassword || !newPassword || !newPassword2) {
      setLocalError('Заполните все поля пароля');
      return;
    }
    if (newPassword.length < 8) {
      setLocalError('Новый пароль должен быть не менее 8 символов');
      return;
    }
    if (!SPECIAL_CHARS.test(newPassword)) {
      setLocalError('Новый пароль должен содержать хотя бы один спецсимвол');
      return;
    }
    if (newPassword !== newPassword2) {
      setLocalError('Новые пароли не совпадают');
      return;
    }
    try {
      await updateProfile({ oldPassword, newPassword });
      setOldPassword('');
      setNewPassword('');
      setNewPassword2('');
      setShowPasswordSection(false);
      setSuccessMsg('Пароль изменён');
      setTimeout(() => setSuccessMsg(''), 2000);
    } catch (err: any) {
      setLocalError(err.message);
    }
  };

  const handleLogout = () => {
    logout();
    onClose();
  };

  const regDate = new Date(user.createdAt);
  const formattedDate = regDate.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Профиль</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {/* User info */}
          <div className="text-center">
            <div className="text-3xl mb-1">{country}</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{user.username}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Регистрация: {formattedDate}</div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{Math.round(user.rating)}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Рейтинг</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{games}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Игр</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
              <div className="text-lg font-bold">
                <span className="text-green-600">{user.wins}</span>
                <span className="text-gray-400 mx-1">/</span>
                <span className="text-red-500">{user.losses}</span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Побед / Поражений</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-white">{winrate}%</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Винрейт</div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-orange-500">{user.bestStreak}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Лучшая серия побед</div>
          </div>

          {/* Quote */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Цитата
            </label>
            <textarea
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              maxLength={200}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
              placeholder="Ваша цитата или девиз..."
            />
            <div className="text-xs text-gray-400 text-right">{quote.length}/200</div>
          </div>

          {/* Country */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Страна
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              {COUNTRIES.map((c) => (
                <option key={c.emoji} value={c.emoji}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={isLoading}
            className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold 
              rounded-lg transition-colors disabled:opacity-50"
          >
            Сохранить профиль
          </button>

          {/* Password change */}
          <div className="border-t dark:border-gray-700 pt-4">
            <button
              onClick={() => setShowPasswordSection(!showPasswordSection)}
              className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400"
            >
              {showPasswordSection ? '▾ Скрыть смену пароля' : '▸ Сменить пароль'}
            </button>

            {showPasswordSection && (
              <div className="mt-3 space-y-3">
                <input
                  type={showPasswordText ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Текущий пароль"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <input
                  type={showPasswordText ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Новый пароль (мин. 8, со спецсимволом)"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <input
                  type={showPasswordText ? 'text' : 'password'}
                  value={newPassword2}
                  onChange={(e) => setNewPassword2(e.target.value)}
                  placeholder="Подтвердите новый пароль"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={showPasswordText}
                    onChange={(e) => setShowPasswordText(e.target.checked)}
                    className="rounded"
                  />
                  Показать пароли
                </label>
                <button
                  onClick={handleChangePassword}
                  disabled={isLoading}
                  className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold 
                    rounded-lg transition-colors disabled:opacity-50"
                >
                  Сменить пароль
                </button>
              </div>
            )}
          </div>

          {/* Messages */}
          {localError && (
            <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2">
              {localError}
            </div>
          )}
          {successMsg && (
            <div className="text-green-600 text-sm bg-green-50 dark:bg-green-900/30 rounded-lg px-3 py-2">
              {successMsg}
            </div>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full py-2 bg-red-500 hover:bg-red-600 text-white font-semibold 
              rounded-lg transition-colors"
          >
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </div>
  );
}
