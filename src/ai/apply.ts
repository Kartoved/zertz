/**
 * The one path through the engine that every bot and measuring tool uses.
 *
 * A bot that scores positions its opponent never reaches is worse than
 * useless, so moves are applied exactly the way the UI applies them
 * (utils/moveActions): placement, then the ring removal or the skip — which
 * claims a group the placement filled — then the win check.
 */

import { CaptureMove, GameState, MarbleColor } from '../game/types';
import {
  canPlaceMarble,
  checkWinCondition,
  cloneState,
  executeCapture,
  getAvailableCaptures,
  getCaptureChains,
  getEmptyRings,
  hasAvailableCaptures,
  placeMarble,
  removeRing,
  skipRingRemoval,
} from '../game/GameEngine';
import { getValidRemovableRings } from '../game/Board';

export type BotMove =
  | { type: 'capture'; chain: CaptureMove[] }
  | { type: 'placement'; ringId: string; color: MarbleColor; removedRingId: string | null };

export const COLORS: MarbleColor[] = ['white', 'gray', 'black'];

/**
 * Applies `move` to a COPY of `state` and settles the result. Returns the new
 * state and, for a placement, the colours its removal (or skip) claimed by
 * isolation — what the move's notation shows after the `+`.
 */
export function applyBotMoveDetailed(state: GameState, move: BotMove): { state: GameState; isolated: MarbleColor[] } {
  const s = cloneState(state);
  let isolated: MarbleColor[] = [];
  if (move.type === 'capture') {
    executeCapture(s, move.chain);
  } else {
    if (!placeMarble(s, move.ringId, move.color)) {
      throw new Error(`illegal placement: ${move.color} on ${move.ringId}`);
    }
    if (move.removedRingId) {
      const claimed = removeRing(s, move.removedRingId);
      if (claimed === false) throw new Error(`illegal ring removal: ${move.removedRingId}`);
      isolated = claimed;
    } else {
      if (getValidRemovableRings(s.rings).length > 0) throw new Error('a ring must be removed');
      isolated = skipRingRemoval(s);
    }
  }
  const winner = checkWinCondition(s);
  if (winner) {
    s.winner = winner;
    s.phase = 'gameOver';
  }
  return { state: s, isolated };
}

export function applyBotMove(state: GameState, move: BotMove): GameState {
  return applyBotMoveDetailed(state, move).state;
}

/** Every complete capture chain the side to move may play (captures are compulsory). */
export function captureMoves(state: GameState): BotMove[] {
  const starts = new Set(getAvailableCaptures(state).map(c => c.from));
  const moves: BotMove[] = [];
  for (const from of starts) {
    for (const chain of getCaptureChains(state, from)) moves.push({ type: 'capture', chain });
  }
  return moves;
}

/** The colours the side to move can place: from the pool, or from its own captures once the pool is empty. */
export function placeableColors(state: GameState): MarbleColor[] {
  return COLORS.filter(color => canPlaceMarble(state, color));
}

/**
 * Every legal move, unthinned — ~3000 on a fresh 48-ring board, so this is the
 * honest baseline for a random mover and for tests, not what a search should
 * iterate.
 *
 * Which rings are free depends only on which rings are REMOVED, never on the
 * marbles, except that a free ring must be empty: placing on R takes exactly R
 * out of the removable set. So the set is computed once, not once per placement
 * (apply.test.ts holds this to the engine's own answer).
 */
export function generateAllMoves(state: GameState): BotMove[] {
  if (state.winner) return [];
  if (hasAvailableCaptures(state)) return captureMoves(state);

  const colors = placeableColors(state);
  if (colors.length === 0) return [];
  const removable = getValidRemovableRings(state.rings);
  const moves: BotMove[] = [];
  for (const ringId of getEmptyRings(state)) {
    const removals = removable.filter(id => id !== ringId);
    for (const color of colors) {
      if (removals.length === 0) moves.push({ type: 'placement', ringId, color, removedRingId: null });
      else for (const removedRingId of removals) moves.push({ type: 'placement', ringId, color, removedRingId });
    }
  }
  return moves;
}

/**
 * A move as a short stable string, for books, logs and equality:
 * `W@0,3-1,0` (placement on 0,3 removing 1,0; `-` alone when nothing was
 * removable) or `x0,3>2,3>2,1` (a capture chain by its landings).
 */
export function moveKey(move: BotMove): string {
  if (move.type === 'capture') {
    return `x${move.chain[0].from}>${move.chain.map(jump => jump.to).join('>')}`;
  }
  return `${move.color[0].toUpperCase()}@${move.ringId}-${move.removedRingId ?? ''}`;
}

/** The legal move in `state` that `key` names; throws when there is none. */
export function moveFromKey(state: GameState, key: string): BotMove {
  const move = generateAllMoves(state).find(m => moveKey(m) === key);
  if (!move) throw new Error(`no legal move ${key}`);
  return move;
}
