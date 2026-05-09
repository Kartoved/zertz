// Ambient type declarations for the JS module canonicalize.js so the
// TypeScript client can import it without `allowJs`. Kept intentionally
// loose (unknown / generic objects) — the implementation is plain JS.

export interface CanonicalizeStateResult {
  canonicalString: string;
  transformIndices: number[];
}

export function serializeUnderTransform(state: unknown, transformIndex: number): string;

export function canonicalizeState(state: unknown): CanonicalizeStateResult;

export function canonicalizeMove(
  move: unknown,
  transformIndices: number[],
  boardSize: 37 | 48 | 61
): unknown;

export function decanonicalizeMove(
  move: unknown,
  transformIndices: number[],
  boardSize: 37 | 48 | 61
): unknown;
