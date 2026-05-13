import { useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useI18n } from '../../i18n';
import { getPostBySlug } from '../../blog/loader';
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

export default function BlogPostPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { toggleDarkMode, isDarkMode } = useUIStore();
  const post = slug ? getPostBySlug(slug) : null;
  const lang = (locale === 'ru' || locale === 'eo') ? locale : 'en';

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm p-3 md:p-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={() => navigate('/blog')}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ← {t.blog}
          </button>
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
        {!post ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 text-center">
            <p className="text-red-500 mb-3">{t.blogPostNotFound}</p>
            <button
              onClick={() => navigate('/blog')}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
            >
              ← {t.blog}
            </button>
          </div>
        ) : (
          <article className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 md:p-6">
            <header className="mb-4 pb-3 border-b dark:border-gray-700">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                {post.pinned && <span className="mr-2 text-amber-500">📌</span>}
                {post.title[lang]}
              </h1>
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>{formatDate(post.date, locale)}</span>
                {post.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </header>
            {post.cover && (
              <img src={post.cover} alt="" className="w-full rounded-lg mb-4" />
            )}
            <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-headings:text-gray-900 dark:prose-headings:text-white prose-a:text-blue-600 dark:prose-a:text-blue-400">
              <ReactMarkdown>{post.body[lang]}</ReactMarkdown>
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
