import { GameNode, GameState, Move, Player } from '../game/types';
import {
  createInitialState,
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
    id: `${moveNumber}-${Date.now()}`,
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

export function rebuildStateFromNode(targetNode: GameNode, boardSize: 37 | 48 | 61): GameState {
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

  return nextState;
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

export function findDeepestMainLine(node: GameNode): GameNode {
  if (node.children.length === 0) return node;
  return findDeepestMainLine(node.children[0]);
}

export function formatGameId(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
