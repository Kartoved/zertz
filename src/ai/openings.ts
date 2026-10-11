/**
 * Varied, level openings for the arena.
 *
 * A few random plies are what make two deterministic bots play different games
 * — but random plies hand over captures (about a third of all quiet moves do),
 * and an opening that is already decided wins both games of its pair for
 * whoever drew the good side. In Quantum Battle a search judged each opening;
 * in ZERTZ the marbles are neutral, so at the start the only asymmetry is in
 * the captures, and a free first-order test exists: nobody has captured
 * anything, and nothing can be captured now. A search-checked book can come
 * once there is a search worth trusting.
 */

import { GameState } from '../game/types';
import { createInitialState, hasAvailableCaptures } from '../game/GameEngine';
import { applyBotMove, generateAllMoves, moveKey } from './apply';
import { rng } from './arena';

export function randomOpening(seed: number, boardSize: 37 | 48 | 61, plies: number): { state: GameState; moves: string[] } {
  const rand = rng(seed);
  let state = createInitialState(boardSize);
  const moves: string[] = [];
  for (let i = 0; i < plies && !state.winner; i++) {
    const options = generateAllMoves(state);
    if (options.length === 0) break;
    const move = options[Math.floor(rand() * options.length)];
    moves.push(moveKey(move));
    state = applyBotMove(state, move);
  }
  return { state, moves };
}

/** Level at first order: no capture made, none available, game still on. */
export function isLevelOpening(state: GameState): boolean {
  if (state.winner) return false;
  const taken = (['player1', 'player2'] as const)
    .reduce((sum, p) => sum + state.captures[p].white + state.captures[p].gray + state.captures[p].black, 0);
  return taken === 0 && !hasAvailableCaptures(state);
}
