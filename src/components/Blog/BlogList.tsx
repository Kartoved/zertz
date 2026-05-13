import { useNavigate, Link } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { getAllPosts } from '../../blog/loader';
import { useUIStore } from '../../store/uiStore';

function formatDate(iso: string, locale: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function BlogList() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { toggleDarkMode, isDarkMode } = useUIStore();
  const posts = getAllPosts();
  const lang = (locale === 'ru' || locale === 'eo') ? locale : 'en';

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm p-3 md:p-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ← {t.menu || 'Menu'}
          </button>
          <h1 className="text-lg md:text-xl font-bold text-gray-800 dark:text-gray-200">
            {t.blog}
          </h1>
          <button
            onClick={toggleDarkMode}
            className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            title={isDarkMode ? t.lightMode : t.darkMode}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 md:p-6">
        {posts.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">{t.blogEmpty}</p>
        ) : (
          <ul className="space-y-3">
            {posts.map(post => (
              <li key={post.slug}>
                <Link
                  to={`/blog/${post.slug}`}
                  className="block bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <h2 className="text-base md:text-lg font-bold text-gray-900 dark:text-white">
                      {post.pinned && <span className="mr-1.5 text-amber-500">📌</span>}
                      {post.title[lang]}
                    </h2>
                    <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 mt-1">
                      {formatDate(post.date, locale)}
                    </span>
                  </div>
                  {post.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {post.tags.map(tag => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
