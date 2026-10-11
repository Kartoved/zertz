import { GameState, Player } from '../game/types';
import { BotMove, applyBotMove, generateAllMoves } from './apply';
import { evaluate } from './evaluate';

export type { BotMove };
export type BotLevel = 'easy' | 'medium' | 'hard';

// Full-width search: on 48–61 only `easy` finishes in reasonable time. Kept as
// the bot the UI shipped with and as the arena's first baseline (`minimax-easy`).
const DEPTHS: Record<BotLevel, number> = {
  easy: 1,
  medium: 3,
  hard: 5,
};

function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  botPlayer: Player,
): number {
  if (state.winner || depth === 0) {
    return evaluate(state, botPlayer);
  }

  const moves = generateAllMoves(state);
  if (moves.length === 0) return evaluate(state, botPlayer);

  const isMaximizing = state.currentPlayer === botPlayer;

  if (isMaximizing) {
    let best = -Infinity;
    for (const move of moves) {
      const child = applyBotMove(state, move);
      const score = minimax(child, depth - 1, alpha, beta, botPlayer);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      const child = applyBotMove(state, move);
      const score = minimax(child, depth - 1, alpha, beta, botPlayer);
      if (score < best) best = score;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
    return best;
  }
}

/** `rand` decides among equal moves; the arena passes a seeded one so matches reproduce. */
export function findBestMove(state: GameState, level: BotLevel, botPlayer: Player, rand: () => number = Math.random): BotMove {
  const depth = DEPTHS[level];
  const moves = generateAllMoves(state);

  // Shuffle to avoid always picking the same move among equals
  for (let i = moves.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [moves[i], moves[j]] = [moves[j], moves[i]];
  }

  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    const child = applyBotMove(state, move);
    const score = minimax(child, depth - 1, -Infinity, Infinity, botPlayer);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}
