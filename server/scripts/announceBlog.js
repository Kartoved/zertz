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

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, ensureSchema } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BLOG_DIR = path.resolve(__dirname, '../../blog');
const SYSTEM_USERNAME = 'Zertz System';

// ---- Frontmatter & body parser (mirror of src/blog/parse.ts, JS edition) ----

function stripQuotes(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function parseFrontmatter(raw) {
  const result = {};
  const lines = raw.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith('#')) { i++; continue; }
    const m = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!m) { i++; continue; }
    const [, key, rest] = m;
    const trimmed = rest.trim();
    if (trimmed === '') {
      const obj = {};
      i++;
      while (i < lines.length && /^\s{2,}\S/.test(lines[i])) {
        const sub = lines[i].match(/^\s+([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
        if (sub) obj[sub[1]] = stripQuotes(sub[2].trim());
        i++;
      }
      result[key] = obj;
      continue;
    }
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      result[key] = trimmed.slice(1, -1).split(',').map(s => stripQuotes(s.trim())).filter(Boolean);
    } else {
      result[key] = stripQuotes(trimmed);
    }
    i++;
  }
  return result;
}

function parsePost(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return null;
  const fm = parseFrontmatter(m[1]);
  const slug = fm.slug || path.basename(filePath, '.md');
  const title = fm.title || {};
  return {
    slug,
    title: { ru: title.ru || title.en || '', en: title.en || title.ru || '', eo: title.eo || title.en || '' },
    announce: fm.announce === 'true' || fm.announce === true,
    date: fm.date || '',
  };
}

function loadAllPosts() {
  if (!fs.existsSync(BLOG_DIR)) return [];
  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));
  return files.map(f => parsePost(path.join(BLOG_DIR, f))).filter(Boolean);
}

// ---- DB helpers ----

async function getAnnouncedSlugs() {
  const result = await pool.query('SELECT slug FROM blog_announced');
  return new Set(result.rows.map(r => r.slug));
}

async function announce(slug, title, dryRun) {
  // Use English title in the chat message; clients localize the destination
  // page anyway. The format is parsed by ChatPanel / GlobalChat to render as
  // a clickable card. Pipe separator is unlikely to appear inside titles.
  const message = `[BLOG_POST]${slug}|${title}`;
  if (dryRun) {
    console.log(`  [DRY] would announce: ${slug} → "${title}"`);
    return;
  }
  await pool.query(
    `INSERT INTO global_chat_messages (user_id, username, message) VALUES ($1, $2, $3)`,
    [null, SYSTEM_USERNAME, message]
  );
  await pool.query(
    `INSERT INTO blog_announced (slug) VALUES ($1)
       ON CONFLICT (slug) DO UPDATE SET announced_at = NOW()`,
    [slug]
  );
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
