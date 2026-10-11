/**
 * The rules on the flat board. A faithful port of src/game/GameEngine.ts —
 * every difference is a bug, and fast/parity.test.ts is what catches it. When
 * the two disagree the fast one is wrong by definition, even when it is "more
 * correct": changing a rule's meaning is a separate change, made in the
 * production engine first.
 *
 * Done differently for speed, never as a rule change: captures are explored
 * with make/unmake instead of cloning, and nothing is addressed by string.
 */

import { EMPTY, MAX_CELLS, REMOVED, colorOf, isMarble } from './board';
import { FastState, NO_WINNER } from './state';

/** Mirrors WIN_CONDITIONS: white, grey, black, and `ALL_COLORS` of each. */
export const WIN_AT = [4, 5, 6];
export const ALL_COLORS = 3;

export interface Jump {
  from: number;
  over: number;
  to: number;
}
export type CaptureSeq = Jump[];

// ───────────────────────────── board queries ─────────────────────────────

const edgeIsFree = (s: FastState, neighbor: number) => neighbor < 0 || s.cells[neighbor] === REMOVED;

/** Free ring: empty, with two ADJACENT free edges. The only kind that can be removed. */
export function isRemovable(s: FastState, cell: number): boolean {
  if (s.cells[cell] !== EMPTY) return false;
  const { neighbors } = s.geo;
  const base = cell * 6;
  let previous = edgeIsFree(s, neighbors[base + 5]);
  for (let dir = 0; dir < 6; dir++) {
    const current = edgeIsFree(s, neighbors[base + dir]);
    if (previous && current) return true;
    previous = current;
  }
  return false;
}

export function removableCells(s: FastState): number[] {
  const out: number[] = [];
  for (let cell = 0; cell < s.geo.n; cell++) if (isRemovable(s, cell)) out.push(cell);
  return out;
}

export function emptyCells(s: FastState): number[] {
  const out: number[] = [];
  for (let cell = 0; cell < s.geo.n; cell++) if (s.cells[cell] === EMPTY) out.push(cell);
  return out;
}

export function poolTotal(s: FastState): number {
  return s.pool[0] + s.pool[1] + s.pool[2];
}

/** Colours the side to move can place: from the pool, or once it is empty from its own captures. */
export function placeableColors(s: FastState): number[] {
  const out: number[] = [];
  const fromPool = poolTotal(s) > 0;
  for (let color = 0; color < 3; color++) {
    if (fromPool ? s.pool[color] > 0 : s.captures[s.side * 3 + color] > 0) out.push(color);
  }
  return out;
}

// ───────────────────────────────── captures ─────────────────────────────────

/**
 * Any capture at all for the side to move — marbles are neutral, so this is the
 * same question for both sides. Stops at the first one and allocates nothing.
 */
export function hasCaptures(s: FastState): boolean {
  const { n, neighbors } = s.geo;
  const cells = s.cells;
  for (let from = 0; from < n; from++) {
    if (!isMarble(cells[from])) continue;
    for (let dir = 0; dir < 6; dir++) {
      const over = neighbors[from * 6 + dir];
      if (over < 0 || !isMarble(cells[over])) continue;
      const to = neighbors[over * 6 + dir];
      if (to >= 0 && cells[to] === EMPTY) return true;
    }
  }
  return false;
}

function pushJumps(s: FastState, from: number, out: Jump[]): void {
  const { neighbors } = s.geo;
  for (let dir = 0; dir < 6; dir++) {
    const over = neighbors[from * 6 + dir];
    if (over < 0 || !isMarble(s.cells[over])) continue;
    const to = neighbors[over * 6 + dir];
    if (to >= 0 && s.cells[to] === EMPTY) out.push({ from, over, to });
  }
}

/** Plays one jump, crediting the side to move; returns the jumped marble for unmake. */
function makeJump(s: FastState, jump: Jump): number {
  const taken = s.cells[jump.over];
  s.cells[jump.to] = s.cells[jump.from];
  s.cells[jump.from] = EMPTY;
  s.cells[jump.over] = EMPTY;
  s.captures[s.side * 3 + colorOf(taken)]++;
  return taken;
}

function unmakeJump(s: FastState, jump: Jump, taken: number): void {
  s.captures[s.side * 3 + colorOf(taken)]--;
  s.cells[jump.over] = taken;
  s.cells[jump.from] = s.cells[jump.to];
  s.cells[jump.to] = EMPTY;
}

/**
 * Every complete capture chain: from each marble with a jump, every path, and a
 * chain ends only where no jump is left (a chain must be played out; which way
 * it goes is free). Mirrors getCaptureChains over every starting marble.
 */
export function captureSequences(s: FastState): CaptureSeq[] {
  const out: CaptureSeq[] = [];
  const path: Jump[] = [];
  const walk = (at: number): void => {
    const jumps: Jump[] = [];
    pushJumps(s, at, jumps);
    if (jumps.length === 0) {
      if (path.length > 0) out.push(path.slice());
      return;
    }
    for (const jump of jumps) {
      const taken = makeJump(s, jump);
      path.push(jump);
      walk(jump.to);
      path.pop();
      unmakeJump(s, jump, taken);
    }
  };
  for (let from = 0; from < s.geo.n; from++) if (isMarble(s.cells[from])) walk(from);
  return out;
}

// ──────────────────────────────── isolation ────────────────────────────────

const seen = new Uint8Array(MAX_CELLS);
const queue = new Int32Array(MAX_CELLS);

/**
 * Claims, for the side to move, every group of rings with no empty ring left —
 * after a removal, or after a placement filled a group's last vacant ring.
 * The rings go too. Returns how many marbles it claimed.
 */
function claimFilledGroups(s: FastState): number {
  const { n, neighbors } = s.geo;
  const cells = s.cells;
  seen.fill(0, 0, n);
  let claimed = 0;
  for (let start = 0; start < n; start++) {
    if (seen[start] || cells[start] === REMOVED) continue;
    let head = 0;
    let tail = 0;
    let hasEmpty = false;
    queue[tail++] = start;
    seen[start] = 1;
    while (head < tail) {
      const cell = queue[head++];
      if (cells[cell] === EMPTY) hasEmpty = true;
      for (let dir = 0; dir < 6; dir++) {
        const next = neighbors[cell * 6 + dir];
        if (next < 0 || seen[next] || cells[next] === REMOVED) continue;
        seen[next] = 1;
        queue[tail++] = next;
      }
    }
    if (hasEmpty) continue;
    for (let i = 0; i < tail; i++) {
      const cell = queue[i];
      if (isMarble(cells[cell])) {
        s.captures[s.side * 3 + colorOf(cells[cell])]++;
        claimed++;
      }
      cells[cell] = REMOVED;
    }
  }
  return claimed;
}

// ─────────────────────────────── whole turns ───────────────────────────────

function endTurn(s: FastState): void {
  s.side = s.side === 0 ? 1 : 0;
  s.moveNumber++;
}

export function applyCapture(s: FastState, seq: CaptureSeq): void {
  for (const jump of seq) makeJump(s, jump);
  endTurn(s);
  settleWinner(s);
}

/**
 * A placement of `color` on `cell`, then the removal of `removed` (-1 when no
 * ring is removable once the marble is down), then the isolation check.
 * Returns how many marbles the turn claimed by isolation.
 */
export function applyPlacement(s: FastState, cell: number, color: number, removed: number): number {
  if (poolTotal(s) > 0) s.pool[color]--;
  else s.captures[s.side * 3 + color]--;
  s.cells[cell] = color + 1;
  if (removed >= 0) s.cells[removed] = REMOVED;
  const claimed = claimFilledGroups(s);
  endTurn(s);
  settleWinner(s);
  return claimed;
}

function reachedGoal(s: FastState, side: number): boolean {
  const c = s.captures;
  const w = c[side * 3];
  const g = c[side * 3 + 1];
  const b = c[side * 3 + 2];
  return w >= WIN_AT[0] || g >= WIN_AT[1] || b >= WIN_AT[2] || (w >= ALL_COLORS && g >= ALL_COLORS && b >= ALL_COLORS);
}

/** Mirrors checkWinCondition: a goal (player1 checked first), else a cleared board for the last mover. */
export function settleWinner(s: FastState): void {
  if (reachedGoal(s, 0)) s.winner = 0;
  else if (reachedGoal(s, 1)) s.winner = 1;
  else {
    for (let cell = 0; cell < s.geo.n; cell++) if (s.cells[cell] !== REMOVED) return;
    s.winner = s.side === 0 ? 1 : 0;
  }
}

/** False when the side to move has no capture, and no empty ring or nothing to place. */
export function hasAnyLegalMove(s: FastState): boolean {
  if (s.winner !== NO_WINNER) return false;
  if (hasCaptures(s)) return true;
  if (placeableColors(s).length === 0) return false;
  for (let cell = 0; cell < s.geo.n; cell++) if (s.cells[cell] === EMPTY) return true;
  return false;
}
