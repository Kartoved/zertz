// ZIP — Zertz Inline Position. A one-line, self-describing snapshot of a ZERTZ
// position (the FEN analog). See docs/ZEN_ZIP_NOTATION.md for the full design.
//
// Format:  <layout> <pool> <cap1> <cap2> <side>
//   layout  columns left→right separated by '/', each column bottom→top.
//           'o' = empty ring, 'W'/'G'/'B' = marble, digit N = run of N absent
//           cells (holes, FEN-style RLE) — covers a column's bottom offset and
//           internal gaps. Holes above a column's top ring are omitted.
//   pool    shared supply  white/gray/black   e.g. 6/8/10
//   cap1    player1 captures white/gray/black
//   cap2    player2 captures
//   side    side to move, '1' or '2'
//
// The layout self-describes the geometry (no board-size tag), so any board shape
// — standard, custom, or a future larger board — round-trips. The hex lattice is
// sheared, so a symmetric board still yields asymmetric leading offset digits.

import { GameState, MarbleColor, Ring } from './types';
import { coordToId, idToCoord, createBoard } from './Board';
import { createInitialState } from './GameEngine';

const COLOR_TO_CHAR: Record<MarbleColor, string> = { white: 'W', gray: 'G', black: 'B' };
const CHAR_TO_COLOR: Record<string, MarbleColor> = { W: 'white', G: 'gray', B: 'black' };

function cellChar(ring: Ring): string {
  return ring.marble ? COLOR_TO_CHAR[ring.marble.color] : 'o';
}

// ─────────────────────────────── encode ───────────────────────────────

export function stateToZip(state: GameState): string {
  // Present cells only; a removed/absent cell is a hole.
  const present: Ring[] = [];
  for (const ring of state.rings.values()) {
    if (!ring.isRemoved) present.push(ring);
  }

  const layout = present.length === 0 ? '' : encodeLayout(present);
  const pool = `${state.reserve.white}/${state.reserve.gray}/${state.reserve.black}`;
  const cap1 = capStr(state, 'player1');
  const cap2 = capStr(state, 'player2');
  const side = state.currentPlayer === 'player1' ? '1' : '2';

  return `${layout} ${pool} ${cap1} ${cap2} ${side}`;
}

function capStr(state: GameState, player: 'player1' | 'player2'): string {
  const c = state.captures[player];
  return `${c.white}/${c.gray}/${c.black}`;
}

function encodeLayout(present: Ring[]): string {
  // Group by column (q), remember content per r.
  const byCol = new Map<number, Map<number, Ring>>();
  let rMax = -Infinity;
  let minQ = Infinity;
  let maxQ = -Infinity;
  for (const ring of present) {
    let col = byCol.get(ring.q);
    if (!col) { col = new Map(); byCol.set(ring.q, col); }
    col.set(ring.r, ring);
    if (ring.r > rMax) rMax = ring.r;
    if (ring.q < minQ) minQ = ring.q;
    if (ring.q > maxQ) maxQ = ring.q;
  }

  const columns: string[] = [];
  for (let q = minQ; q <= maxQ; q++) {
    const col = byCol.get(q);
    if (!col || col.size === 0) { columns.push(''); continue; } // fully-absent column

    const colMinR = Math.min(...col.keys()); // topmost present ring
    let out = '';
    let holeRun = 0;
    // Walk bottom (rMax) → top (colMinR). Larger r is lower on the board.
    for (let r = rMax; r >= colMinR; r--) {
      const ring = col.get(r);
      if (ring) {
        if (holeRun > 0) { out += String(holeRun); holeRun = 0; }
        out += cellChar(ring);
      } else {
        holeRun++;
      }
    }
    columns.push(out);
  }
  return columns.join('/');
}

// ─────────────────────────────── decode ───────────────────────────────

export function zipToState(zip: string): GameState {
  const parts = zip.trim().split(/\s+/);
  if (parts.length < 5) throw new Error(`Invalid ZIP: expected 5 fields, got ${parts.length}`);
  const [layout, pool, cap1, cap2, side] = parts;

  const cells = decodeLayout(layout); // [{ q, r, char }] in relative coordinates

  // Anchor onto a standard template (37/48/61) when the shape fits, so the
  // reconstructed board uses the SAME absolute coordinates + ids as the engine
  // (drop-in for rebuildStateFromNode, idToAlgebraic, etc.) and includes removed
  // rings as isRemoved. Truly custom shapes that fit no template keep relative
  // coordinates. Either way adjacency is preserved.
  const anchored = anchorToTemplate(cells);
  let state: GameState;
  if (anchored) {
    state = createInitialState(anchored.boardSize);
    const contentById = new Map(anchored.cells.map(c => [coordToId(c.q, c.r), c.char]));
    for (const ring of state.rings.values()) {
      const char = contentById.get(ring.id);
      if (char === undefined) ring.isRemoved = true;
      else ring.marble = char === 'o' ? null : { color: CHAR_TO_COLOR[char] };
    }
  } else {
    state = createInitialState(inferBoardSize(cells.length));
    const rings = new Map<string, Ring>();
    for (const { q, r, char } of cells) {
      const id = coordToId(q, r);
      const marble = char === 'o' ? null : { color: CHAR_TO_COLOR[char] };
      rings.set(id, { id, q, r, marble, isRemoved: false });
    }
    state.rings = rings;
  }

  const [w, g, b] = pool.split('/').map(Number);
  state.reserve = { white: w, gray: g, black: b };
  state.captures.player1 = triple(cap1);
  state.captures.player2 = triple(cap2);
  state.currentPlayer = side === '2' ? 'player2' : 'player1';
  state.phase = 'placement';
  state.winner = null;
  state.pendingPlacement = null;
  state.moveNumber = 1;

  return state;
}

interface DecodedCell { q: number; r: number; char: string; }

function decodeLayout(layout: string): DecodedCell[] {
  const cells: DecodedCell[] = [];
  const columns = layout.split('/');
  for (let q = 0; q < columns.length; q++) {
    const s = columns[q];
    let p = 0; // position from the bottom; r = -p (relative)
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch >= '0' && ch <= '9') {
        // Multi-digit hole run.
        let num = 0;
        while (i < s.length && s[i] >= '0' && s[i] <= '9') { num = num * 10 + (s.charCodeAt(i) - 48); i++; }
        i--; // for-loop will ++ again
        p += num;
      } else {
        cells.push({ q, r: -p, char: ch });
        p += 1;
      }
    }
  }
  return cells;
}

function triple(s: string): { white: number; gray: number; black: number } {
  const [white, gray, black] = s.split('/').map(Number);
  return { white, gray, black };
}

// Try to place the decoded (relative) cells onto a standard template by pure
// translation. Returns template-anchored cells + the board size, or null if no
// template fits (a genuinely custom shape). Smallest template first, so a 37
// board decodes as 37. Translation preserves adjacency, so any valid offset is
// equally correct; we take the first.
function anchorToTemplate(
  cells: DecodedCell[],
): { boardSize: 37 | 48 | 61; cells: DecodedCell[] } | null {
  if (cells.length === 0) return null;
  for (const boardSize of [37, 48, 61] as const) {
    const template = new Set(createBoard(boardSize).keys());
    if (cells.length > template.size) continue;
    const off = findTranslation(cells, template);
    if (off) {
      return {
        boardSize,
        cells: cells.map(c => ({ q: c.q + off.dq, r: c.r + off.dr, char: c.char })),
      };
    }
  }
  return null;
}

// A translation (dq,dr) mapping every decoded cell into the template cell set,
// found by trying to send the first decoded cell to each template cell.
function findTranslation(cells: DecodedCell[], template: Set<string>): { dq: number; dr: number } | null {
  const d0 = cells[0];
  for (const id of template) {
    const { q, r } = idToCoord(id);
    const dq = q - d0.q;
    const dr = r - d0.r;
    if (cells.every(c => template.has(coordToId(c.q + dq, c.r + dr)))) return { dq, dr };
  }
  return null;
}

// Fallback board-size (only for custom shapes that fit no template): the smallest
// standard board whose ring count can hold the decoded cells.
function inferBoardSize(cellCount: number): 37 | 48 | 61 {
  if (cellCount <= 37) return 37;
  if (cellCount <= 48) return 48;
  return 61;
}
