import { GameNode, Player, PreMoveNode, PreMoveTree } from '../game/types';
import { checkWinCondition, getWinType } from '../game/GameEngine';
import { applyPlacement, normalizePhase } from '../utils/moveActions';
import { rebuildStateFromNode } from '../utils/gameTreeUtils';
import { serializeState } from '../db/apiClient';

function makeNodeId(): string {
  return `pm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Outcome of the arm-plan flow — drives the UI (confirm dialog, toasts).
export type SavePremoveResult =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'error' | 'incompleteMove' }
  | { ok: false; reason: 'ownMoveFirst'; firstMoveNotation: string };

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
// `hasIncompleteMove` flags a placement that still owes a ring removal (which
// would hang the game if fired) so the caller can refuse.
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
