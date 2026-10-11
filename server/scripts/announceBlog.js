/**
 * Announces blog posts in the global chat.
 *
 * For every post in blog/*.md with `announce: true` that hasn't been recorded
 * in blog_announced, inserts a system message in global_chat_messages and
 * marks the slug as announced. Idempotent — safe to re-run.
 *
 * Usage:
 *   node server/scripts/announceBlog.js                  # announce all new
 *   node server/scripts/announceBlog.js --slug=v0.13.0   # force this slug
 *   node server/scripts/announceBlog.js --dry-run        # preview only
 *   node server/scripts/announceBlog.js --list           # show state
 *
 * In Docker: docker compose exec -T web node server/scripts/announceBlog.js
 */

import { pool, ensureSchema } from '../db.js';
import { loadAllPosts, announcePost } from '../utils/blogPosts.js';

// ---- DB helpers ----

async function getAnnouncedSlugs() {
  const result = await pool.query('SELECT slug FROM blog_announced');
  return new Set(result.rows.map(r => r.slug));
}

async function announce(slug, title, dryRun) {
  // Use English title in the chat message; clients localize the destination
  // page anyway.
  if (dryRun) {
    console.log(`  [DRY] would announce: ${slug} → "${title}"`);
    return;
  }
  await announcePost(pool, slug, title);
  console.log(`  ✓ announced: ${slug} → "${title}"`);
}

// ---- CLI ----

function parseArgs(argv) {
  const args = { slug: null, dryRun: false, list: false };
  for (const a of argv.slice(2)) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--list') args.list = true;
    else if (a.startsWith('--slug=')) args.slug = a.slice(7);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  await ensureSchema();

  const posts = loadAllPosts();
  const announced = await getAnnouncedSlugs();

  if (args.list) {
    console.log(`\n[blog:announce] Posts found: ${posts.length}\n`);
    for (const p of posts) {
      const flag = announced.has(p.slug) ? '✓ announced' : (p.announce ? '· pending' : '— skipped (announce:false)');
      console.log(`  ${flag}  ${p.slug}  (${p.date})`);
    }
    return;
  }

  if (args.slug) {
    const post = posts.find(p => p.slug === args.slug);
    if (!post) {
      console.error(`[blog:announce] Post not found: ${args.slug}`);
      process.exitCode = 1;
      return;
    }
    console.log(`[blog:announce] Forcing announcement for: ${post.slug}`);
    await announce(post.slug, post.title.en || post.title.ru, args.dryRun);
    return;
  }

  const pending = posts.filter(p => p.announce && !announced.has(p.slug));
  if (pending.length === 0) {
    console.log('[blog:announce] Nothing to announce. All posts up to date.');
    return;
  }

  // Oldest first so the chat thread reads chronologically.
  pending.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  console.log(`[blog:announce] ${pending.length} post(s) to announce${args.dryRun ? ' (dry run)' : ''}:`);
  for (const post of pending) {
    await announce(post.slug, post.title.en || post.title.ru, args.dryRun);
  }
}

main()
  .catch(err => {
    console.error('[blog:announce] Error:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
