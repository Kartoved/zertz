import { GameNode, PreMoveStep } from '../game/types';
import { checkWinCondition, getWinType } from '../game/GameEngine';
import { normalizePhase } from '../utils/moveActions';
import { rebuildStateFromNode } from '../utils/gameTreeUtils';
import { serializeState } from '../db/apiClient';

// Walks from `currentNode` up to (but excluding) the start anchor and builds a
// pre-move sequence. Returns an empty array when the anchor is unreachable or
// the path is empty.
//
// Each step carries a precomputed post-move state. `rebuildStateFromNode`
// replays moves but doesn't recompute phase after captures — we normalize so
// the server doesn't store a broken `placement` phase when captures are
// actually mandatory.
export function buildPremoveSequence(
  currentNode: GameNode,
  startNodeId: string,
  boardSize: 37 | 48 | 61
): PreMoveStep[] {
  const path: GameNode[] = [];
  let node: GameNode | null = currentNode;
  while (node && node.id !== startNodeId) {
    path.unshift(node);
    node = node.parent;
  }
  if (!node || path.length === 0) return [];

  const sequence: PreMoveStep[] = [];
  for (const moveNode of path) {
    if (!moveNode.move) continue;
    const stepState = rebuildStateFromNode(moveNode, boardSize);
    const winner = checkWinCondition(stepState);
    const winType = winner ? getWinType(stepState, winner) : null;

    if (winner) stepState.phase = 'gameOver';
    normalizePhase(stepState);

    sequence.push({
      move: moveNode.move,
      notation: moveNode.notation,
      player: moveNode.player,
      newStateJson: serializeState(stepState),
      newCurrentPlayer: stepState.currentPlayer === 'player1' ? 1 : 2,
      newWinner: winner === 'player1' ? 1 : winner === 'player2' ? 2 : null,
      newWinType: winType,
    });
  }
  return sequence;
}

export function makeVariantId(): string {
  return `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
