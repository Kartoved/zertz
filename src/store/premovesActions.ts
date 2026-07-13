import { GameNode, Move, Player, PreMoveNode, PreMoveTree } from '../game/types';
import { checkWinCondition, getWinType } from '../game/GameEngine';
import { applyPlacement, normalizePhase } from '../utils/moveActions';
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

// Outcome of the pre-move save/arm flow — drives the UI (confirm dialogs, toasts).
export type SavePremoveResult =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'error' | 'incompleteMove' }
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

// Snapshots the analysis subtree rooted at `anchorNode` into a pre-move tree —
// the "build variations on the board, then arm them all" (Lichess-style) flow.
//
// Alternation is enforced from the actual node players: opponent-move nodes keep
// EVERY child (branches on my planned replies to each opponent reply), while my
// nodes keep only their main-line child (children[0]) — from one position I play
// one move. Root children are the opponent's expected first moves; any of my own
// moves at the root are ignored here (those are "arm-from-own", played live).
//
// `droppedMyAlternatives` flags that some of my explored side-lines were dropped
// to satisfy the one-reply-per-position invariant, so the UI can hint at it.
export function analysisSubtreeToTree(
  anchorNode: GameNode,
  owner: Player,
  boardSize: 37 | 48 | 61,
  anchorStateJson: string
): { tree: PreMoveTree | null; droppedMyAlternatives: boolean; hasOwnFirstMove: boolean; hasIncompleteMove: boolean } {
  let dropped = false;
  let incomplete = false;

  const buildNode = (node: GameNode): PreMoveNode => {
    // A placement that needs a ring removal but carries none is an unfinished
    // move (the user placed but never removed a ring). Firing/storing it would
    // hang or corrupt the game — flag it so the caller refuses.
    if (node.move!.type === 'placement' && !node.move!.data.removedRingId && node.parent) {
      const preState = rebuildStateFromNode(node.parent, boardSize);
      normalizePhase(preState);
      const placed = applyPlacement(preState, node.move!.data.ringId, node.move!.data.marbleColor);
      if (placed && placed.needsRingRemoval) incomplete = true;
    }

    const stepState = rebuildStateFromNode(node, boardSize);
    const winner = checkWinCondition(stepState);
    const winType = winner ? getWinType(stepState, winner) : null;
    if (winner) stepState.phase = 'gameOver';
    normalizePhase(stepState);

    // My move → children are opponent moves (keep all); opponent move → children
    // are my replies (keep only the main line).
    let childNodes: GameNode[];
    if (node.player === owner) {
      childNodes = node.children.filter(c => c.move);
    } else {
      const withMoves = node.children.filter(c => c.move);
      childNodes = withMoves.slice(0, 1);
      if (withMoves.length > 1) dropped = true;
    }

    return {
      id: makeNodeId(),
      move: node.move!,
      notation: node.notation,
      player: node.player,
      newStateJson: serializeState(stepState),
      newCurrentPlayer: stepState.currentPlayer === 'player1' ? 1 : 2,
      newWinner: winner === 'player1' ? 1 : winner === 'player2' ? 2 : null,
      newWinType: winType,
      children: childNodes.map(buildNode),
    };
  };

  const firstMoves = anchorNode.children.filter(c => c.move);
  const opponentFirst = firstMoves.filter(c => c.player !== owner);
  const hasOwnFirstMove = firstMoves.some(c => c.player === owner);

  const rootChildren = opponentFirst.map(buildNode);
  if (rootChildren.length === 0) {
    return { tree: null, droppedMyAlternatives: dropped, hasOwnFirstMove, hasIncompleteMove: incomplete };
  }
  return {
    tree: { anchorStateJson, children: rootChildren },
    droppedMyAlternatives: dropped,
    hasOwnFirstMove,
    hasIncompleteMove: incomplete,
  };
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
