export type BlogLocale = 'ru' | 'en' | 'eo';

export interface BlogPost {
  slug: string;
  date: string;       // ISO YYYY-MM-DD
  tags: string[];
  version?: string;   // for changelog posts
  pinned: boolean;
  announce: boolean;
  title: Record<BlogLocale, string>;
  body: Record<BlogLocale, string>;
  cover?: string;
}
