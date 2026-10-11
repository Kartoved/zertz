// Announces a new release in the global chat once, on the first server start
// that runs it. The running version is APP_VERSION from src/version.ts (the
// Docker image ships the whole repo). If a blog post carries `version: <it>`,
// its `[BLOG_POST]` card is posted (unless already announced by hand);
// otherwise a generic `[APP_UPDATE]<version>` card linking to /news.
// Idempotent via app_versions_announced. Disable with ANNOUNCE_UPDATES=0.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';
import { loadAllPosts, announcePost, SYSTEM_USERNAME } from './utils/blogPosts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERSION_FILE = path.resolve(__dirname, '../src/version.ts');

export function readAppVersion() {
  try {
    const src = fs.readFileSync(VERSION_FILE, 'utf8');
    return src.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function announceAppVersion() {
  if (process.env.ANNOUNCE_UPDATES === '0') return;
  const version = readAppVersion();
  if (!version) return;

  // Claim the version atomically — a second start (or instance) is a no-op.
  const claim = await pool.query(
    `INSERT INTO app_versions_announced (version) VALUES ($1)
       ON CONFLICT (version) DO NOTHING RETURNING version`,
    [version]
  );
  if (claim.rowCount === 0) return;

  const post = loadAllPosts().find(p => p.version === version);
  if (post) {
    const done = await pool.query('SELECT 1 FROM blog_announced WHERE slug = $1', [post.slug]);
    if (done.rowCount > 0) return; // already announced via `npm run blog:announce`
    await announcePost(pool, post.slug, post.title.en || post.title.ru);
  } else {
    await pool.query(
      `INSERT INTO global_chat_messages (user_id, username, message) VALUES ($1, $2, $3)`,
      [null, SYSTEM_USERNAME, `[APP_UPDATE]${version}`]
    );
  }
  console.log(`[release] announced v${version}${post ? ` (post ${post.slug})` : ''}`);
}
