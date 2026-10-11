import { describe, it, expect } from 'vitest';
import { parseMarkdownPost } from './parse';

const POST = [
  '---',
  'slug: v9.9.9',
  'date: 2026-10-11',
  'version: 9.9.9',
  'title:',
  '  ru: "Заголовок"',
  '  en: "Title"',
  '---',
  '',
  '# ru',
  '',
  'Текст.',
  '',
  '# en',
  '',
  'Text.',
].join('\n');

describe('parseMarkdownPost', () => {
  it('reads the frontmatter the same with LF and CRLF line endings', () => {
    for (const raw of [POST, POST.replace(/\n/g, '\r\n')]) {
      const post = parseMarkdownPost('fallback', raw)!;
      expect(post.version).toBe('9.9.9');
      expect(post.date).toBe('2026-10-11');
      expect(post.title.en).toBe('Title');
      expect(post.body.ru).toBe('Текст.');
    }
  });
});
