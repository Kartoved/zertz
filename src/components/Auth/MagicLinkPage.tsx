import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { verifyMagicToken } from '../../db/authApi';
import { useAuthStore } from '../../store/authStore';
import { useI18n } from '../../i18n';

export default function MagicLinkPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithToken } = useAuthStore();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setErrorMsg(t.magicLinkError);
      return;
    }

    verifyMagicToken(token)
      .then(({ token: jwt, user }) => {
        loginWithToken(jwt, user);
        setStatus('success');
        setTimeout(() => navigate('/'), 1500);
      })
      .catch((err) => {
        setStatus('error');
        setErrorMsg(err.message || t.magicLinkError);
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-sm w-full text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">ZERTZ</h1>
        {status === 'verifying' && (
          <p className="text-gray-600 dark:text-gray-300">{t.magicLinkVerifying}</p>
        )}
        {status === 'success' && (
          <p className="text-green-600 dark:text-green-400 font-semibold">{t.magicLinkSuccess}</p>
        )}
        {status === 'error' && (
          <>
            <p className="text-red-500 font-semibold mb-4">{errorMsg}</p>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              {t.login}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
