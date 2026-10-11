/**
 * The fast engine's position, and conversion to and from the production
 * `GameState`. Everything is a small typed array, so a clone is a memcpy.
 */

import { GameState, MarbleColor } from '../../game/types';
import { createBoard } from '../../game/Board';
import { BoardSize, EMPTY, Geometry, REMOVED, colorOf, geometry, isMarble } from './board';

export const NO_WINNER = -1;

export interface FastState {
  geo: Geometry;
  cells: Uint8Array;
  /** The shared pool, by colour. */
  pool: Uint8Array;
  /** `[p1 white, p1 grey, p1 black, p2 white, …]`. */
  captures: Uint8Array;
  /** 0 = player1, 1 = player2. */
  side: 0 | 1;
  moveNumber: number;
  /** 0 / 1, or NO_WINNER. */
  winner: number;
}

export const COLOR_NAMES: MarbleColor[] = ['white', 'gray', 'black'];

export function cloneFast(s: FastState): FastState {
  return {
    geo: s.geo,
    cells: s.cells.slice(),
    pool: s.pool.slice(),
    captures: s.captures.slice(),
    side: s.side,
    moveNumber: s.moveNumber,
    winner: s.winner,
  };
}

export function fromGameState(state: GameState): FastState {
  const geo = geometry(state.boardSize as BoardSize);
  const cells = new Uint8Array(geo.n);
  for (let i = 0; i < geo.n; i++) {
    const ring = state.rings.get(geo.ids[i]);
    if (!ring || ring.isRemoved) cells[i] = REMOVED;
    else cells[i] = ring.marble ? COLOR_NAMES.indexOf(ring.marble.color) + 1 : EMPTY;
  }
  const pool = Uint8Array.from(COLOR_NAMES, c => state.reserve[c]);
  const captures = Uint8Array.from(
    [...COLOR_NAMES.map(c => state.captures.player1[c]), ...COLOR_NAMES.map(c => state.captures.player2[c])],
  );
  return {
    geo,
    cells,
    pool,
    captures,
    side: state.currentPlayer === 'player1' ? 0 : 1,
    moveNumber: state.moveNumber,
    winner: state.winner === 'player1' ? 0 : state.winner === 'player2' ? 1 : NO_WINNER,
  };
}

export function toGameState(s: FastState): GameState {
  const rings = createBoard(s.geo.size);
  for (let i = 0; i < s.geo.n; i++) {
    const ring = rings.get(s.geo.ids[i])!;
    const cell = s.cells[i];
    ring.isRemoved = cell === REMOVED;
    ring.marble = isMarble(cell) ? { color: COLOR_NAMES[colorOf(cell)] } : null;
  }
  const triple = (from: Uint8Array, at: number) => ({ white: from[at], gray: from[at + 1], black: from[at + 2] });
  const winner = s.winner === 0 ? 'player1' : s.winner === 1 ? 'player2' : null;
  return {
    rings,
    boardSize: s.geo.size,
    reserve: triple(s.pool, 0),
    currentPlayer: s.side === 0 ? 'player1' : 'player2',
    captures: { player1: triple(s.captures, 0), player2: triple(s.captures, 3) },
    phase: winner ? 'gameOver' : 'placement',
    pendingPlacement: null,
    winner,
    moveNumber: s.moveNumber,
  };
}
