import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';
import { requestMagicLink } from '../../db/authApi';

const SPECIAL_CHARS = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;

interface AuthModalProps {
  onClose: () => void;
}

export default function AuthModal({ onClose }: AuthModalProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  // Magic link state
  const [magicEmail, setMagicEmail] = useState('');
  const [magicSent, setMagicSent] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicError, setMagicError] = useState('');

  const { login, register, isLoading } = useAuthStore();

  const handleLogin = async () => {
    setLocalError('');
    if (!username.trim() || !password) {
      setLocalError(t.fillAllFields);
      return;
    }
    try {
      await login(username.trim(), password);
      onClose();
    } catch (err: any) {
      setLocalError(err.message);
    }
  };

  const handleRegister = async () => {
    setLocalError('');
    if (!username.trim() || !password || !password2) {
      setLocalError(t.fillAllFields);
      return;
    }
    if (username.trim().length < 2 || username.trim().length > 24) {
      setLocalError(t.nicknameRangeError);
      return;
    }
    if (password.length < 8) {
      setLocalError(t.passwordLengthError);
      return;
    }
    if (!SPECIAL_CHARS.test(password)) {
      setLocalError(t.passwordCharError);
      return;
    }
    if (password !== password2) {
      setLocalError(t.passwordsMismatch);
      return;
    }
    try {
      await register(username.trim(), password, email.trim() || undefined);
      onClose();
    } catch (err: any) {
      setLocalError(err.message);
    }
  };

  const handleMagicLink = async () => {
    setMagicError('');
    if (!magicEmail.trim()) return;
    setMagicLoading(true);
    try {
      await requestMagicLink(magicEmail.trim());
      setMagicSent(true);
    } catch (err: any) {
      setMagicError(err.message);
    } finally {
      setMagicLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === 'login') handleLogin();
    else handleRegister();
  };

  const switchTab = (newTab: 'login' | 'register') => {
    setTab(newTab);
    setLocalError('');
    setMagicError('');
    setMagicSent(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b dark:border-gray-700">
          <button
            onClick={() => switchTab('login')}
            className={`flex-1 py-3 px-4 text-center font-semibold transition-colors ${
              tab === 'login'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t.login}
          </button>
          <button
            onClick={() => switchTab('register')}
            className={`flex-1 py-3 px-4 text-center font-semibold transition-colors ${
              tab === 'register'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t.register}
          </button>
          <button
            onClick={onClose}
            className="px-4 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Password-based form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t.nickname}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={24}
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder={t.yourNickname}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t.password}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg
                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                    focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder={t.passwordHint}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700
                    dark:hover:text-gray-300 text-sm px-1"
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {tab === 'register' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t.confirmPassword}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password2}
                      onChange={(e) => setPassword2(e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg
                        bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                        focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      placeholder={t.repeatPassword}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t.emailLabel} <span className="text-gray-400 font-normal text-xs">({t.emailOptionalHint})</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                      bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                      focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder={t.emailPlaceholder}
                  />
                </div>
              </>
            )}

            {localError && (
              <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2">
                {localError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold
                rounded-lg transition-colors disabled:opacity-50"
            >
              {isLoading ? t.loading : tab === 'login' ? t.login : t.register}
            </button>
          </form>

          {/* Magic link section (login tab only) */}
          {tab === 'login' && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-600" />
                <span className="text-xs text-gray-400 dark:text-gray-500">{t.orSeparator}</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-600" />
              </div>

              {magicSent ? (
                <div className="text-center text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-3">
                  ✓ {t.magicLinkSent}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t.loginWithMagicLink}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={magicEmail}
                      onChange={(e) => setMagicEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleMagicLink()}
                      placeholder={t.emailPlaceholder}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg
                        bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                        focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                    <button
                      onClick={handleMagicLink}
                      disabled={magicLoading || !magicEmail.trim()}
                      className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-semibold
                        rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {magicLoading ? '...' : t.sendMagicLink}
                    </button>
                  </div>
                  {magicError && (
                    <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2">
                      {magicError}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
