/**
 * A bot game in the forms the site reads: a GameNode tree (what a study
 * stores) and ZEN text (what an import or an export reads). record.test.ts
 * replays every recorded game back through ZEN.
 */

import { GameNode, GameState, MarbleColor, Move } from '../game/types';
import { treeToZen, ZenMeta } from '../game/zen';
import { addMoveToTree, createRootNode } from '../utils/gameTreeUtils';
import { BotMove, applyBotMoveDetailed } from './apply';

export function botMoveToMove(move: BotMove, isolated: MarbleColor[] = []): Move {
  if (move.type === 'capture') {
    const [first, ...rest] = move.chain;
    return { type: 'capture', data: { ...first, chain: rest } };
  }
  return {
    type: 'placement',
    data: {
      marbleColor: move.color,
      ringId: move.ringId,
      removedRingId: move.removedRingId,
      ...(isolated.length ? { isolatedCaptures: isolated } : {}),
    },
  };
}

export interface RecordedBotGame {
  root: GameNode;
  zen: string;
  /** The position after the last move. */
  final: GameState;
}

/** Plays `moves` from `start` and records them as one main line. */
export function recordGame(start: GameState, moves: BotMove[], meta: ZenMeta = {}): RecordedBotGame {
  const root = createRootNode();
  let node = root;
  let state = start;
  for (const move of moves) {
    const { state: next, isolated } = applyBotMoveDetailed(state, move);
    node = addMoveToTree(node, botMoveToMove(move, isolated), state.currentPlayer, state.moveNumber, state.boardSize);
    state = next;
  }
  return { root, zen: treeToZen(start, root, meta), final: state };
}
