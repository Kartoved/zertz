import { BlogPost } from './types';
import { parseMarkdownPost } from './parse';

// All blog markdown files are loaded at build time as raw strings. Vite inlines
// them into the bundle — no runtime fetch, no server roundtrip.
const RAW_POSTS = import.meta.glob('/blog/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

let cached: BlogPost[] | null = null;

export function getAllPosts(): BlogPost[] {
  if (cached) return cached;
  const posts: BlogPost[] = [];
  for (const [path, raw] of Object.entries(RAW_POSTS)) {
    const fileSlug = path.replace(/^.*\/(.*)\.md$/, '$1');
    const post = parseMarkdownPost(fileSlug, raw);
    if (post) posts.push(post);
  }
  // Sort: pinned first, then by date descending.
  posts.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  });
  cached = posts;
  return posts;
}

export function getPostBySlug(slug: string): BlogPost | null {
  return getAllPosts().find(p => p.slug === slug) || null;
}

export function getPostsByTag(tag: string): BlogPost[] {
  return getAllPosts().filter(p => p.tags.includes(tag));
}
