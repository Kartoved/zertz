/**
 * Flat, integer-only board geometry for the fast engine.
 *
 * The production engine addresses rings by the string `"q,r"` in a `Map` of
 * objects — right for the UI, hopeless for search: a placement plus removal
 * costs ~110 µs, most of it string parsing and cloning 48 objects. In Quantum
 * Battle the same rewrite gave 4–5x nodes/s, a ply, and +131 Elo.
 *
 * Here a board is N cells numbered 0..N-1 and every geometric question is a
 * typed-array lookup built once per board size. A jump from `c` in direction
 * `d` passes over `neighbors[c*6+d]` and lands on that cell's neighbour in the
 * same direction.
 *
 * This is a THIRD implementation of the rules (after src/game/GameEngine.ts and
 * shared/explorer/replay.js): fast/parity.test.ts holds it to the production
 * engine ply by ply.
 */

import { createBoard, idToCoord } from '../../game/Board';

export type BoardSize = 37 | 48 | 61;

/** Cell contents: a marble is `color + 1` (0 white, 1 grey, 2 black). */
export const EMPTY = 0;
export const REMOVED = 4;
export const WHITE = 0;
export const GRAY = 1;
export const BLACK = 2;

export const isMarble = (cell: number) => cell !== EMPTY && cell !== REMOVED;
export const colorOf = (cell: number) => cell - 1;

/** Most cells on any board; scratch buffers are sized to it. */
export const MAX_CELLS = 64;

export interface Geometry {
  size: BoardSize;
  n: number;
  /** Index → production ring id, for conversion and notation. */
  ids: string[];
  index: Map<string, number>;
  /** `neighbors[cell * 6 + dir]`, or -1 past the board edge. */
  neighbors: Int32Array;
  /** Rings from the board's centroid — how central a cell is. */
  centre: Int32Array;
}

// Same order as HEX_DIRECTIONS in src/game/Board.ts, so `(dir + 3) % 6` is the
// opposite direction and "two adjacent free edges" means neighbouring dirs.
const DIRS: Array<[number, number]> = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
];

const cache = new Map<BoardSize, Geometry>();

export function geometry(size: BoardSize): Geometry {
  const cached = cache.get(size);
  if (cached) return cached;

  // The production template is the single source of which cells exist.
  const ids = Array.from(createBoard(size).keys());
  const n = ids.length;
  const index = new Map(ids.map((id, i) => [id, i]));
  const coords = ids.map(idToCoord);

  const neighbors = new Int32Array(n * 6).fill(-1);
  coords.forEach(({ q, r }, cell) => {
    DIRS.forEach(([dq, dr], dir) => {
      const next = index.get(`${q + dq},${r + dr}`);
      if (next !== undefined) neighbors[cell * 6 + dir] = next;
    });
  });

  // Distance from the centroid, not from axial (0,0): the origin is a RIM cell
  // on these boards, a bug that skewed Quantum's move ordering for months.
  const cq = coords.reduce((sum, c) => sum + c.q, 0) / n;
  const cr = coords.reduce((sum, c) => sum + c.r, 0) / n;
  const centre = Int32Array.from(coords, ({ q, r }) => {
    const dq = q - cq;
    const dr = r - cr;
    return Math.round((Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2);
  });

  const geo: Geometry = { size, n, ids, index, neighbors, centre };
  cache.set(size, geo);
  return geo;
}
