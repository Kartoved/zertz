/**
 * Bots behind one interface, so the arena can pit any two against each other.
 *
 * The first four are the YARDSTICKS the measuring stand is validated with: a
 * match between neighbours on this ladder must come out clearly one-sided, and
 * a bot against itself must come out level, before any number from the stand
 * is believed (docs/BOT_LESSONS_FROM_QUANTUM.md).
 *
 *   random       uniform over every legal move — the zero of the Elo scale
 *   safe-random  random, but never hands the opponent a capture when it can avoid it
 *   minimax-easy the bot the UI shipped with: one ply, no look at the replies
 *   greedy       one ply, then every forced capture played out (quiescence)
 */

import { GameState, Player } from '../game/types';
import { hasAvailableCaptures } from '../game/GameEngine';
import { BotMove, applyBotMove, captureMoves, generateAllMoves } from './apply';
import { BotLevel, findBestMove } from './minimax';
import { evaluate } from './evaluate';

export interface Bot {
  readonly name: string;
  /** `null` only when the position offers no legal move at all. */
  pickMove(state: GameState, player: Player, rand: () => number): BotMove | null;
}

function shuffled<T>(items: T[], rand: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const randomBot: Bot = {
  name: 'random',
  pickMove(state, _player, rand) {
    const moves = generateAllMoves(state);
    return moves.length ? moves[Math.floor(rand() * moves.length)] : null;
  },
};

/**
 * Random, but a quiet move that leaves the opponent a compulsory capture is
 * only played when every move does. Captures stay random.
 */
export const safeRandomBot: Bot = {
  name: 'safe-random',
  pickMove(state, _player, rand) {
    const moves = shuffled(generateAllMoves(state), rand);
    if (moves.length === 0) return null;
    if (moves[0].type === 'capture') return moves[0];
    for (const move of moves) {
      const next = applyBotMove(state, move);
      if (next.winner || !hasAvailableCaptures(next)) return move;
    }
    return moves[0];
  },
};

export function minimaxBot(level: BotLevel): Bot {
  return {
    name: `minimax-${level}`,
    pickMove(state, player, rand) {
      return generateAllMoves(state).length ? findBestMove(state, level, player, rand) : null;
    },
  };
}

/** Captures are compulsory: a position offering one is not a resting position. */
function quiesce(state: GameState, me: Player, depth: number): number {
  if (state.winner || depth === 0 || !hasAvailableCaptures(state)) return evaluate(state, me);
  const mine = state.currentPlayer === me;
  let best = mine ? -Infinity : Infinity;
  for (const move of captureMoves(state)) {
    const score = quiesce(applyBotMove(state, move), me, depth - 1);
    best = mine ? Math.max(best, score) : Math.min(best, score);
  }
  return best;
}

const QUIESCENCE_DEPTH = 10;

export const greedyBot: Bot = {
  name: 'greedy',
  pickMove(state, player, rand) {
    const moves = shuffled(generateAllMoves(state), rand);
    let best: BotMove | null = null;
    let bestScore = -Infinity;
    for (const move of moves) {
      const score = quiesce(applyBotMove(state, move), player, QUIESCENCE_DEPTH);
      if (score > bestScore) { bestScore = score; best = move; }
    }
    return best;
  },
};
