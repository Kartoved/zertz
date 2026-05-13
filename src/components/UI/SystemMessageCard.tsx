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
  return null;
}

function BlogPostCard({ slug, title }: { slug: string; title: string }) {
  const { t } = useI18n();
  return (
    <Link
      to={`/blog/${slug}`}
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
