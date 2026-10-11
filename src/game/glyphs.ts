import type { MoveGlyph } from './types';

// Move-quality marks, chess style. Order = toolbar order. NAG numbers are the
// standard PGN ones ($1…$6), accepted on ZEN import.
export const MOVE_GLYPHS: MoveGlyph[] = ['!!', '!', '!?', '?!', '?', '??'];

export const GLYPH_NAG: Record<MoveGlyph, number> = { '!': 1, '?': 2, '!!': 3, '??': 4, '!?': 5, '?!': 6 };

const NAG_GLYPH: Record<number, MoveGlyph> = Object.fromEntries(
  Object.entries(GLYPH_NAG).map(([g, n]) => [n, g as MoveGlyph]),
) as Record<number, MoveGlyph>;

export function glyphFromNag(nag: number): MoveGlyph | null {
  return NAG_GLYPH[nag] ?? null;
}

export function isMoveGlyph(s: string): s is MoveGlyph {
  return (MOVE_GLYPHS as string[]).includes(s);
}

/** Lichess palette: brilliant/good green, interesting pink, dubious blue,
 *  mistake orange, blunder red. */
export const GLYPH_COLOR: Record<MoveGlyph, string> = {
  '!!': '#168226',
  '!': '#22ac38',
  '!?': '#ea45d8',
  '?!': '#56b4e9',
  '?': '#e69f00',
  '??': '#df5353',
};
