import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n';

// Renders a system message body. Currently supports only `[BLOG_POST]slug|title`,
// but the dispatch shape lets us add more prefixes later (`[TOURNAMENT]…`, etc.).
// Returns `null` when the body isn't a system marker — callers fall back to
// plain-text rendering in that case.
export function tryRenderSystemBody(body: string): { node: React.ReactElement; kind: string } | null {
  const blog = body.match(/^\[BLOG_POST\]([^|]+)\|(.+)$/s);
  if (blog) {
    return { kind: 'blog', node: <BlogPostCard slug={blog[1]} title={blog[2]} /> };
  }
  const tour = body.match(/^\[TOURNAMENT\]([^|]+)\|(.+)$/s);
  if (tour) {
    return { kind: 'tournament', node: <TournamentCard id={tour[1]} name={tour[2]} /> };
  }
  return null;
}

function TournamentCard({ id, name }: { id: string; name: string }) {
  const { t } = useI18n();
  return (
    <Link
      to={`/tournaments/${id}`}
      className="block bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700/50 rounded-lg p-2.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
    >
      <div className="text-[10px] uppercase tracking-wide font-semibold text-indigo-700 dark:text-indigo-300">
        🏆 {t.arenaStatusActive}
      </div>
      <div className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
        {name}
      </div>
    </Link>
  );
}

function BlogPostCard({ slug, title }: { slug: string; title: string }) {
  const { t } = useI18n();
  return (
    <Link
      to={`/news/${slug}`}
      className="block bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 rounded-lg p-2.5 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
    >
      <div className="text-[10px] uppercase tracking-wide font-semibold text-amber-700 dark:text-amber-300">
        📰 {t.blogNewPost}
      </div>
      <div className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
        {title}
      </div>
    </Link>
  );
}

export const SYSTEM_USERNAME = 'Zertz System';

export function isSystemActor(username: string | null | undefined): boolean {
  return username === SYSTEM_USERNAME;
}
