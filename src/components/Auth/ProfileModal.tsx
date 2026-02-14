import { useMemo, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import CountryBadge from '../UI/CountryBadge';
import { normalizeCountryValue } from '../../utils/country';
import { useI18n } from '../../i18n';
import { getCountryOptions } from '../../utils/countries';

const SPECIAL_CHARS = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;

interface ProfileModalProps {
  onClose: () => void;
}

export default function ProfileModal({ onClose }: ProfileModalProps) {
  const { t, language, locale } = useI18n();
  const { user, updateProfile, logout, isLoading } = useAuthStore();
  const [quote, setQuote] = useState(user?.quote || '');
  const [country, setCountry] = useState(normalizeCountryValue(user?.country || '🌍'));
  const [contactLink, setContactLink] = useState(user?.contactLink || '');
  const [isEditingQuote, setIsEditingQuote] = useState(false);
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [localError, setLocalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const countries = useMemo(() => getCountryOptions(language), [language]);

  if (!user) return null;

  const games = user.wins + user.losses;
  const winrate = games > 0 ? Math.round((user.wins / games) * 100) : 0;

  const handleSaveProfile = async () => {
    setLocalError('');
    setSuccessMsg('');
    try {
      const trimmedContact = contactLink.trim();
      if (trimmedContact) {
        try {
          new URL(trimmedContact);
        } catch {
          setLocalError(t.contactInvalid);
          return;
        }
      }

      await updateProfile({ quote, country, contactLink: trimmedContact });
      setSuccessMsg(t.profileUpdated);
      setTimeout(() => setSuccessMsg(''), 2000);
      setIsEditingQuote(false);
    } catch (err: any) {
      setLocalError(err.message);
    }
  };

  const handleChangePassword = async () => {
    setLocalError('');
    setSuccessMsg('');
    if (!oldPassword || !newPassword || !newPassword2) {
      setLocalError(t.fillAllPasswordFields);
      return;
    }
    if (newPassword.length < 8) {
      setLocalError(t.newPasswordLengthError);
      return;
    }
    if (!SPECIAL_CHARS.test(newPassword)) {
      setLocalError(t.newPasswordCharError);
      return;
    }
    if (newPassword !== newPassword2) {
      setLocalError(t.newPasswordsMismatch);
      return;
    }
    try {
      await updateProfile({ oldPassword, newPassword });
      setOldPassword('');
      setNewPassword('');
      setNewPassword2('');
      setShowPasswordSection(false);
      setSuccessMsg(t.passwordChanged);
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
  const formattedDate = regDate.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t.profileTitle}</h2>
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
            <div className="text-3xl mb-1">
              <CountryBadge country={country} size={30} />
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{user.username}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{t.registrationDate}: {formattedDate}</div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{Math.round(user.rating)}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{t.rating}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{games}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{t.games}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
              <div className="text-lg font-bold">
                <span className="text-green-600">{user.wins}</span>
                <span className="text-gray-400 mx-1">/</span>
                <span className="text-red-500">{user.losses}</span>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{t.winsLosses}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-white">{winrate}%</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{t.winrate}</div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-orange-500">{user.bestStreak}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{t.bestStreak}</div>
          </div>

          {/* Quote */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t.quote}
              </label>
              <button
                type="button"
                onClick={() => setIsEditingQuote(!isEditingQuote)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                ✎
              </button>
            </div>

            {isEditingQuote ? (
              <>
                <textarea
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                  maxLength={200}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                  placeholder={t.quotePlaceholder}
                />
                <div className="text-xs text-gray-400 text-right">{quote.length}/200</div>
              </>
            ) : (
              <blockquote className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 italic">
                {quote.trim() ? `"${quote}"` : t.quoteNotSet}
              </blockquote>
            )}
          </div>

          {/* Contact link */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t.contact}
            </label>
            <input
              type="url"
              value={contactLink}
              onChange={(e) => setContactLink(e.target.value)}
              placeholder={t.contactPlaceholder}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Country */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t.country}
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCountryDropdownOpen((prev) => !prev)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none
                  flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <CountryBadge country={country} size={20} />
                  {countries.find((c) => c.code === country)?.name || t.chooseCountry}
                </span>
                <span className="text-gray-500">{isCountryDropdownOpen ? '▴' : '▾'}</span>
              </button>

              {isCountryDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-lg">
                  {countries.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => {
                        setCountry(c.code);
                        setIsCountryDropdownOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2 text-gray-900 dark:text-white"
                    >
                      <CountryBadge country={c.code} size={20} />
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={isLoading}
            className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold 
              rounded-lg transition-colors disabled:opacity-50"
          >
            {t.saveProfile}
          </button>

          {/* Password change */}
          <div className="border-t dark:border-gray-700 pt-4">
            <button
              onClick={() => setShowPasswordSection(!showPasswordSection)}
              className="text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400"
            >
              {showPasswordSection ? t.hidePasswordChange : t.showPasswordChange}
            </button>

            {showPasswordSection && (
              <div className="mt-3 space-y-3">
                <input
                  type={showPasswordText ? 'text' : 'password'}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder={t.currentPassword}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <input
                  type={showPasswordText ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t.newPasswordPlaceholder}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <input
                  type={showPasswordText ? 'text' : 'password'}
                  value={newPassword2}
                  onChange={(e) => setNewPassword2(e.target.value)}
                  placeholder={t.confirmNewPassword}
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
                  {t.showPasswords}
                </label>
                <button
                  onClick={handleChangePassword}
                  disabled={isLoading}
                  className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold 
                    rounded-lg transition-colors disabled:opacity-50"
                >
                  {t.changePassword}
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
            {t.logout}
          </button>
        </div>
      </div>
    </div>
  );
}
