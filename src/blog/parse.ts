import { BlogLocale, BlogPost } from './types';

const LOCALES: BlogLocale[] = ['ru', 'en', 'eo'];

// Minimal YAML-lite parser for our specific frontmatter shape:
//
//   key: value                 ← scalar
//   key: [a, b]                ← inline array
//   key:                       ← nested object
//     subkey: value
//
// Strings can be quoted ("..." or '...') or bare. Values are kept as raw
// strings here; consumers cast where needed (`pinned`/`announce` to booleans).
function parseFrontmatter(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = raw.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith('#')) { i++; continue; }

    const match = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!match) { i++; continue; }
    const [, key, rest] = match;
    const trimmed = rest.trim();

    if (trimmed === '') {
      // Nested object — collect indented lines below.
      const obj: Record<string, string> = {};
      i++;
      while (i < lines.length && /^\s{2,}\S/.test(lines[i])) {
        const sub = lines[i].match(/^\s+([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
        if (sub) {
          obj[sub[1]] = stripQuotes(sub[2].trim());
        }
        i++;
      }
      result[key] = obj;
      continue;
    }

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      // Inline array, comma-separated.
      result[key] = trimmed.slice(1, -1).split(',').map(s => stripQuotes(s.trim())).filter(Boolean);
    } else {
      result[key] = stripQuotes(trimmed);
    }
    i++;
  }
  return result;
}

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

// Splits a body into per-locale sections. Each locale section starts with
// `# ru` / `# en` / `# eo` (literal heading containing only the locale code)
// and continues until the next such heading or end of file.
function splitBody(body: string): Record<BlogLocale, string> {
  const result: Record<BlogLocale, string> = { ru: '', en: '', eo: '' };
  const lines = body.split('\n');
  let currentLocale: BlogLocale | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (currentLocale) {
      result[currentLocale] = buffer.join('\n').trim();
    }
    buffer = [];
  };

  for (const line of lines) {
    const heading = line.match(/^#\s+(ru|en|eo)\s*$/);
    if (heading) {
      flush();
      currentLocale = heading[1] as BlogLocale;
    } else if (currentLocale) {
      buffer.push(line);
    }
  }
  flush();

  // Fallback: if no locale headings at all, treat the whole body as English.
  if (!result.ru && !result.en && !result.eo && body.trim()) {
    result.en = body.trim();
  }
  return result;
}

export function parseMarkdownPost(slug: string, raw: string): BlogPost | null {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;

  const fm = parseFrontmatter(match[1]);
  const body = match[2];
  const bodies = splitBody(body);

  const titleObj = (fm.title as Record<string, string>) || {};
  const title: Record<BlogLocale, string> = {
    ru: titleObj.ru || titleObj.en || '',
    en: titleObj.en || titleObj.ru || '',
    eo: titleObj.eo || titleObj.en || titleObj.ru || '',
  };

  // Ensure all locales have something to render (fallback chain ru → en → eo).
  const filledBody: Record<BlogLocale, string> = { ru: '', en: '', eo: '' };
  for (const loc of LOCALES) {
    filledBody[loc] = bodies[loc] || bodies.en || bodies.ru || bodies.eo || '';
  }

  return {
    slug: (fm.slug as string) || slug,
    date: (fm.date as string) || '',
    tags: Array.isArray(fm.tags) ? (fm.tags as string[]) : [],
    version: fm.version as string | undefined,
    pinned: fm.pinned === 'true' || fm.pinned === true,
    announce: fm.announce === 'true' || fm.announce === true,
    title,
    body: filledBody,
    cover: fm.cover as string | undefined,
  };
}
