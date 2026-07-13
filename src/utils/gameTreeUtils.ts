import { GameNode, GameState, Move, Player } from '../game/types';
import {
  createInitialState,
  cloneState,
  placeMarble,
  removeRing,
  skipRingRemoval,
  executeCapture,
  moveToNotation,
} from '../game/GameEngine';
import { getI18nFromStorage } from '../i18n';

export function getDefaultPlayerNames() {
  const { language } = getI18nFromStorage();
  if (language === 'ru') return { player1: 'Игрок 1', player2: 'Игрок 2' };
  if (language === 'eo') return { player1: 'Ludanto 1', player2: 'Ludanto 2' };
  return { player1: 'Player 1', player2: 'Player 2' };
}

export function createRootNode(): GameNode {
  return {
    id: 'root',
    moveNumber: 0,
    player: 'player1',
    move: null,
    notation: '',
    children: [],
    parent: null,
    isMainLine: true,
  };
}

export function addMoveToTree(
  currentNode: GameNode,
  move: Move,
  player: Player,
  moveNumber: number,
  boardSize: 37 | 48 | 61
): GameNode {
  const newNode: GameNode = {
    id: crypto.randomUUID(),
    moveNumber,
    player,
    move,
    notation: moveToNotation(move, boardSize),
    children: [],
    parent: currentNode,
    isMainLine: currentNode.children.length === 0,
  };
  currentNode.children.push(newNode);
  return newNode;
}

// Cache of fully-replayed states keyed by their GameNode. WeakMap so entries
// are automatically evicted when nodes are GC'd (e.g. after undo). Callers
// that mutate a node after creation (applyRingRemoval patches removedRingId)
// must call invalidateNodeStateCache to keep entries consistent.
const nodeStateCache = new WeakMap<GameNode, GameState>();

export function invalidateNodeStateCache(node: GameNode): void {
  nodeStateCache.delete(node);
}

export function rebuildStateFromNode(targetNode: GameNode, boardSize: 37 | 48 | 61): GameState {
  const cached = nodeStateCache.get(targetNode);
  if (cached) return cloneState(cached);

  const nextState = createInitialState(boardSize);
  const moves: GameNode[] = [];

  let node: GameNode | null = targetNode;
  while (node && node.move) {
    moves.unshift(node);
    node = node.parent;
  }

  for (const moveNode of moves) {
    if (moveNode.move?.type === 'placement') {
      const { marbleColor, ringId, removedRingId } = moveNode.move.data;
      placeMarble(nextState, ringId, marbleColor);
      if (removedRingId) {
        removeRing(nextState, removedRingId);
      } else {
        skipRingRemoval(nextState);
      }
    } else if (moveNode.move?.type === 'capture') {
      const captures = [moveNode.move.data, ...(moveNode.move.data.chain || [])];
      executeCapture(nextState, captures);
    }
  }

  // Only cache nodes whose move is fully committed (placement has removedRingId
  // resolved, or is a capture). Root node (move === null) is always the same.
  const move = targetNode.move;
  const isCommitted =
    move === null ||
    move.type === 'capture' ||
    (move.type === 'placement' && move.data.removedRingId !== null);
  if (isCommitted) nodeStateCache.set(targetNode, cloneState(nextState));

  return nextState;
}

// Depth of a node from the root (root === 0, first move === 1, …).
export function nodeDepth(node: GameNode): number {
  let d = 0;
  let n = node.parent;
  while (n) {
    d++;
    n = n.parent;
  }
  return d;
}

// Walks `steps` main-line (children[0]) hops down from `root`, stopping early if
// the line ends. Used to locate the live position inside the analysis tree
// (whose children[0] chain mirrors the live main line).
export function mainLineNodeAtDepth(root: GameNode, steps: number): GameNode {
  let n = root;
  for (let i = 0; i < steps && n.children[0]; i++) n = n.children[0];
  return n;
}

export function findNodeAndParent(root: GameNode, targetId: string): { node: GameNode; parent: GameNode | null } | null {
  const stack: Array<{ node: GameNode; parent: GameNode | null }> = [{ node: root, parent: null }];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.node.id === targetId) return current;
    for (const child of current.node.children) {
      stack.push({ node: child, parent: current.node });
    }
  }
  return null;
}

export function isDescendant(root: GameNode, targetId: string): boolean {
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.id === targetId) return true;
    stack.push(...current.children);
  }
  return false;
}

// After splicing a child out of `parent.children`, call this to ensure the
// `isMainLine` flags stay in sync: children[0] is the main line, the rest aren't.
export function syncMainLineFlags(parent: GameNode): void {
  for (let i = 0; i < parent.children.length; i++) {
    parent.children[i].isMainLine = i === 0;
  }
}

export function findDeepestMainLine(node: GameNode): GameNode {
  let current = node;
  while (current.children.length > 0) {
    current = current.children[0];
  }
  return current;
}

export function formatGameId(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
