// Cyrillic → Latin transliteration + slugify, used to derive a default URL
// handle from a study title. The result is user-editable afterwards.

const CYRILLIC_MAP = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

export function transliterate(input) {
  let out = '';
  for (const ch of String(input).toLowerCase()) {
    out += Object.prototype.hasOwnProperty.call(CYRILLIC_MAP, ch) ? CYRILLIC_MAP[ch] : ch;
  }
  return out;
}

// Produce a URL-safe slug: transliterate, lowercase, non-alphanumerics → '-',
// collapse repeats, trim dashes. Falls back to 'study' when nothing survives
// (e.g. a title of only emoji/CJK), so the URL is never empty.
export function slugify(title) {
  const slug = transliterate(title)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80);
  return slug || 'study';
}

// Ensures uniqueness within a set of already-taken slugs by appending -2, -3…
export function uniqueSlug(base, taken) {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
