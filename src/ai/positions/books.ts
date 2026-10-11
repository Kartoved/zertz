/**
 * Opening books by board size, built by scripts/book.ts. An opening is a list
 * of moves (apply.ts `moveKey`) from the initial position; `zip` is the
 * position it leads to, for people to read — never parsed back.
 */

import { BOOK_37 } from './book37';
import { BOOK_48 } from './book48';
import { BOOK_61 } from './book61';

export interface BookOpening {
  moves: string[];
  zip: string;
}

export const BOOKS: Partial<Record<number, BookOpening[]>> = { 37: BOOK_37, 48: BOOK_48, 61: BOOK_61 };
