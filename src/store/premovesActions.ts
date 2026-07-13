import { GameNode, Move, Player, PreMoveNode, PreMoveTree } from '../game/types';
import { checkWinCondition, getWinType } from '../game/GameEngine';
import { normalizePhase } from '../utils/moveActions';
import { rebuildStateFromNode } from '../utils/gameTreeUtils';
import { serializeState } from '../db/apiClient';

// One planned move with its precomputed post-move state (the same payload a
// PreMoveNode carries, minus tree bookkeeping).
export interface PreMovePathStep {
  move: Move;
  notation: string;
  player: Player;
  newStateJson: string;
  newCurrentPlayer: 1 | 2;
  newWinner: number | null;
  newWinType: string | null;
}

// Walks from `currentNode` up to (but excluding) the start anchor and returns
// the moves in chronological order, each carrying a precomputed post-move
// state. Returns an empty array when the anchor is unreachable or the path is
// empty.
//
// `rebuildStateFromNode` replays moves but doesn't recompute phase after
// captures — we normalize so a broken `placement` phase isn't stored when
// captures are actually mandatory.
export function pathFromAnchor(
  currentNode: GameNode,
  startNodeId: string,
  boardSize: 37 | 48 | 61
): PreMovePathStep[] {
  const path: GameNode[] = [];
  let node: GameNode | null = currentNode;
  while (node && node.id !== startNodeId) {
    path.unshift(node);
    node = node.parent;
  }
  if (!node || path.length === 0) return [];

  const steps: PreMovePathStep[] = [];
  for (const moveNode of path) {
    if (!moveNode.move) continue;
    const stepState = rebuildStateFromNode(moveNode, boardSize);
    const winner = checkWinCondition(stepState);
    const winType = winner ? getWinType(stepState, winner) : null;

    if (winner) stepState.phase = 'gameOver';
    normalizePhase(stepState);

    steps.push({
      move: moveNode.move,
      notation: moveNode.notation,
      player: moveNode.player,
      newStateJson: serializeState(stepState),
      newCurrentPlayer: stepState.currentPlayer === 'player1' ? 1 : 2,
      newWinner: winner === 'player1' ? 1 : winner === 'player2' ? 2 : null,
      newWinType: winType,
    });
  }
  return steps;
}

export function makeNodeId(): string {
  return `pm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function movesEqual(a: Move | null | undefined, b: Move | null | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function stepToNode(step: PreMovePathStep): PreMoveNode {
  return {
    id: makeNodeId(),
    move: step.move,
    notation: step.notation,
    player: step.player,
    newStateJson: step.newStateJson,
    newCurrentPlayer: step.newCurrentPlayer,
    newWinner: step.newWinner,
    newWinType: step.newWinType,
    children: [],
  };
}

export type MergeResult =
  | { ok: true; tree: PreMoveTree }
  | { ok: false; conflict: { existingNotation: string; newNotation: string } };

// Outcome of roomStore.savePremovePath — drives the UI (confirm dialogs, toasts).
export type SavePremoveResult =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'error' }
  | { ok: false; reason: 'conflict'; existingNotation: string; newNotation: string }
  | { ok: false; reason: 'ownMoveFirst'; firstMoveNotation: string };

// Merges a linear analysis path into the pre-move tree.
//
// Levels alternate: a step whose player === `owner` is MY move (an opponent
// node's single forced child); any other step is an expected OPPONENT move (a
// branch). Matching is by move-equality, so shared prefixes collapse.
//
// Conflict: adding MY move under an opponent node that already holds a
// *different* response violates the "one reply per position" invariant. Without
// `overwrite` we return the conflict for the UI to confirm; with `overwrite`
// the old response and its whole subtree are dropped and replaced.
export function mergePathIntoTree(
  existing: PreMoveTree | null,
  steps: PreMovePathStep[],
  anchorStateJson: string,
  owner: Player,
  overwrite: boolean
): MergeResult {
  // Start fresh when there's no tree or the live anchor has moved on.
  const base: PreMoveTree =
    existing && existing.anchorStateJson === anchorStateJson
      ? (JSON.parse(JSON.stringify(existing)) as PreMoveTree)
      : { anchorStateJson, children: [] };

  let siblings = base.children;
  for (const step of steps) {
    const isMyMove = step.player === owner;
    let match = siblings.find(c => movesEqual(c.move, step.move));
    if (!match) {
      // My move under an opponent node that already has a (differing) reply.
      if (isMyMove && siblings.length > 0) {
        if (!overwrite) {
          return {
            ok: false,
            conflict: { existingNotation: siblings[0].notation, newNotation: step.notation },
          };
        }
        siblings.length = 0; // drop the stale response subtree
      }
      match = stepToNode(step);
      siblings.push(match);
    }
    siblings = match.children;
  }
  return { ok: true, tree: base };
}

// Removes the subtree rooted at `nodeId` from the tree. Returns a new tree (or
// null when the tree becomes empty). No-op clone when the id isn't found.
export function removeBranch(tree: PreMoveTree | null, nodeId: string): PreMoveTree | null {
  if (!tree) return null;
  const clone = JSON.parse(JSON.stringify(tree)) as PreMoveTree;
  const prune = (nodes: PreMoveNode[]): PreMoveNode[] =>
    nodes
      .filter(n => n.id !== nodeId)
      .map(n => ({ ...n, children: prune(n.children) }));
  clone.children = prune(clone.children);
  return clone.children.length > 0 ? clone : null;
}
