import { GameState, MarbleColor, CaptureMove, Move, GameNode, Player } from '../game/types';
import {
  cloneState,
  placeMarble,
  removeRing,
  executeCapture,
  skipRingRemoval,
  checkWinCondition,
  getWinType,
  moveToNotation,
} from '../game/GameEngine';
import { getValidRemovableRings } from '../game/Board';

export interface PlacementApplyResult {
  newState: GameState;
  move: Move;
  winner: Player | null;
  winType: string | null;
  needsRingRemoval: boolean;
}

export interface RingRemovalApplyResult {
  newState: GameState;
  winner: Player | null;
  winType: string | null;
}

export interface CaptureApplyResult {
  newState: GameState;
  move: Move;
  previousPlayer: Player;
  previousMoveNumber: number;
  winner: Player | null;
  winType: string | null;
}

// Applies placement to state. Does NOT touch the game tree.
// Returns null if placement is invalid.
export function applyPlacement(
  state: GameState,
  ringId: string,
  color: MarbleColor
): PlacementApplyResult | null {
  const newState = cloneState(state);
  if (!placeMarble(newState, ringId, color)) return null;

  const needsRingRemoval = getValidRemovableRings(newState.rings).length > 0;

  const move: Move = {
    type: 'placement',
    data: { marbleColor: color, ringId, removedRingId: null },
  };

  if (!needsRingRemoval) {
    skipRingRemoval(newState);
  }

  const winner = resolveWin(newState);
  const winType = winner ? getWinType(newState, winner) : null;

  return { newState, move, winner, winType, needsRingRemoval };
}

// Applies ring removal to state and mutates the currentNode with ring + isolation info.
// Returns null if removal is invalid.
export function applyRingRemoval(
  state: GameState,
  currentNode: GameNode,
  ringId: string
): RingRemovalApplyResult | null {
  const newState = cloneState(state);
  const isolated = removeRing(newState, ringId);
  if (isolated === false) return null;

  // Update the existing tree node (shared pattern in both stores)
  if (currentNode.move?.type === 'placement') {
    currentNode.move.data.removedRingId = ringId;
    if (isolated.length > 0) currentNode.move.data.isolatedCaptures = isolated;
    currentNode.notation = moveToNotation(currentNode.move, state.boardSize);
  }

  const winner = resolveWin(newState);
  const winType = winner ? getWinType(newState, winner) : null;

  return { newState, winner, winType };
}

// Applies a capture chain to state. Does NOT touch the game tree.
export function applyCapture(
  state: GameState,
  captures: CaptureMove[]
): CaptureApplyResult {
  const newState = cloneState(state);
  const previousPlayer = state.currentPlayer;
  const previousMoveNumber = state.moveNumber;

  executeCapture(newState, captures);

  const move: Move = {
    type: 'capture',
    data: { ...captures[0], chain: captures.slice(1) },
  };

  const winner = resolveWin(newState);
  const winType = winner ? getWinType(newState, winner) : null;

  return { newState, move, previousPlayer, previousMoveNumber, winner, winType };
}

// Checks win condition, sets state.winner and state.phase if won. Returns winner or null.
function resolveWin(state: GameState): Player | null {
  const winner = checkWinCondition(state);
  if (winner) {
    state.winner = winner;
    state.phase = 'gameOver';
  }
  return winner;
}
