import { GameNode, GameState } from '../../game/types';
import { placeMarble, removeRing, skipRingRemoval, executeCapture } from '../../game/GameEngine';
import { deserializeState } from '../../db/apiClient';

// Reconstructs the board state at `node` by replaying moves root→node onto the
// study's STARTING position (setupJson), not createInitialState — a study may
// begin from a custom setup (Etap D). Mirrors the move-application loop of
// rebuildStateFromNode. deserializeState returns a fresh object each call, so
// there's no shared-cache mutation to worry about.
export function studyStateAtNode(setupJson: string, node: GameNode): GameState {
  const state = deserializeState(setupJson);
  const moves: GameNode[] = [];
  let n: GameNode | null = node;
  while (n && n.move) { moves.unshift(n); n = n.parent; }

  for (const mv of moves) {
    if (mv.move?.type === 'placement') {
      const { marbleColor, ringId, removedRingId } = mv.move.data;
      placeMarble(state, ringId, marbleColor);
      if (removedRingId) removeRing(state, removedRingId);
      else skipRingRemoval(state);
    } else if (mv.move?.type === 'capture') {
      const captures = [mv.move.data, ...(mv.move.data.chain || [])];
      executeCapture(state, captures);
    }
  }
  return state;
}

// Finds a node by id anywhere in the tree (DFS). Returns null if absent.
export function findNodeById(root: GameNode, id: string): GameNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}
