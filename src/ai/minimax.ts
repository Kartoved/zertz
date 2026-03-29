import { GameState, MarbleColor, CaptureMove, Player } from '../game/types';
import {
  cloneState,
  hasAvailableCaptures,
  getCaptureChains,
  getAvailableCaptures,
  getEmptyRings,
  placeMarble,
  removeRing,
  executeCapture,
  skipRingRemoval,
  checkWinCondition,
} from '../game/GameEngine';
import { getValidRemovableRings } from '../game/Board';
import { evaluate } from './evaluate';

export type BotLevel = 'easy' | 'medium' | 'hard';

export type BotMove =
  | { type: 'capture'; chain: CaptureMove[] }
  | { type: 'placement'; ringId: string; color: MarbleColor; removedRingId: string | null };

const DEPTHS: Record<BotLevel, number> = {
  easy: 1,
  medium: 3,
  hard: 5,
};

// Apply a complete bot move, returning the resulting state (next player's turn)
function applyBotMove(state: GameState, move: BotMove): GameState {
  const s = cloneState(state);

  if (move.type === 'capture') {
    executeCapture(s, move.chain);
    const winner = checkWinCondition(s);
    if (winner) { s.winner = winner; s.phase = 'gameOver'; }
    return s;
  }

  // Placement
  placeMarble(s, move.ringId, move.color);
  const winner1 = checkWinCondition(s);
  if (winner1) { s.winner = winner1; s.phase = 'gameOver'; return s; }

  if (move.removedRingId) {
    removeRing(s, move.removedRingId);
  } else {
    skipRingRemoval(s);
  }
  const winner2 = checkWinCondition(s);
  if (winner2) { s.winner = winner2; s.phase = 'gameOver'; }
  return s;
}

// Generate all legal complete moves from a placement-phase state
function generateMoves(state: GameState): BotMove[] {
  const moves: BotMove[] = [];

  // Mandatory captures
  if (hasAvailableCaptures(state)) {
    const startRings = new Set(getAvailableCaptures(state).map(c => c.from));
    for (const ringId of startRings) {
      const chains = getCaptureChains(state, ringId);
      for (const chain of chains) {
        moves.push({ type: 'capture', chain });
      }
    }
    return moves;
  }

  // Placements
  const emptyRings = getEmptyRings(state);
  const colors: MarbleColor[] = [];
  const reserveTotal = state.reserve.white + state.reserve.gray + state.reserve.black;
  if (reserveTotal > 0) {
    if (state.reserve.white > 0) colors.push('white');
    if (state.reserve.gray > 0) colors.push('gray');
    if (state.reserve.black > 0) colors.push('black');
  } else {
    const caps = state.captures[state.currentPlayer];
    if (caps.white > 0) colors.push('white');
    if (caps.gray > 0) colors.push('gray');
    if (caps.black > 0) colors.push('black');
  }

  for (const ringId of emptyRings) {
    for (const color of colors) {
      const s = cloneState(state);
      if (!placeMarble(s, ringId, color)) continue;

      const removable = getValidRemovableRings(s.rings);
      if (removable.length === 0) {
        moves.push({ type: 'placement', ringId, color, removedRingId: null });
      } else {
        for (const removedRingId of removable) {
          moves.push({ type: 'placement', ringId, color, removedRingId });
        }
      }
    }
  }

  return moves;
}

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

  const moves = generateMoves(state);
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

export function findBestMove(state: GameState, level: BotLevel, botPlayer: Player): BotMove {
  const depth = DEPTHS[level];
  const moves = generateMoves(state);

  // Shuffle to avoid always picking the same move among equals
  for (let i = moves.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
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
