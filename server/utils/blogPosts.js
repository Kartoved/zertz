// Blog post loading + chat announcing, shared by the `blog:announce` CLI
// (server/scripts/announceBlog.js) and the automatic release announcement on
// server start (server/announceUpdate.js).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const BLOG_DIR = path.resolve(__dirname, '../../blog');
export const SYSTEM_USERNAME = 'Zertz System';

// ---- Frontmatter & body parser (mirror of src/blog/parse.ts, JS edition) ----

function stripQuotes(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

export function parseFrontmatter(raw) {
  const result = {};
  const lines = raw.split(/\r?\n/); // posts may be checked out with CRLF
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

export function parsePost(filePath) {
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
    version: typeof fm.version === 'string' ? fm.version : null,
    date: fm.date || '',
  };
}

export function loadAllPosts() {
  if (!fs.existsSync(BLOG_DIR)) return [];
  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));
  return files.map(f => parsePost(path.join(BLOG_DIR, f))).filter(Boolean);
}

// Posts a `[BLOG_POST]slug|title` card into the global chat and records the
// slug in blog_announced. The pipe separator is unlikely to appear in titles;
// clients render the body as a clickable card (SystemMessageCard.tsx).
export async function announcePost(pool, slug, title) {
  await pool.query(
    `INSERT INTO global_chat_messages (user_id, username, message) VALUES ($1, $2, $3)`,
    [null, SYSTEM_USERNAME, `[BLOG_POST]${slug}|${title}`]
  );
  await pool.query(
    `INSERT INTO blog_announced (slug) VALUES ($1)
       ON CONFLICT (slug) DO UPDATE SET announced_at = NOW()`,
    [slug]
  );
}
