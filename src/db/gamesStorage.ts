import { GameState, GameNode } from '../game/types';
import * as api from './gamesApi';
import * as local from './indexedDB';

export async function saveGame(
  id: string,
  state: GameState,
  tree: GameNode,
  playerNames: { player1: string; player2: string },
  winType: string | null
): Promise<void> {
  await local.saveGame(id, state, tree, playerNames, winType);
  try {
    await api.saveGame(id, state, tree, playerNames, winType);
  } catch {
    // Keep local save as fallback
  }
}

export async function loadGame(id: string): Promise<{
  state: GameState;
  tree: GameNode;
  playerNames: { player1: string; player2: string };
  winType: string | null;
} | null> {
  try {
    const remote = await api.loadGame(id);
    if (remote) return remote;
  } catch {
    // fall back to local
  }
  return local.loadGame(id);
}

export async function listGames(): Promise<Array<{
  id: string;
  playerNames: { player1: string; player2: string };
  updatedAt: number;
  moveCount: number;
  winner: string | null;
  winType: string | null;
  boardSize: 37 | 48 | 61;
}>> {
  try {
    const remote = await api.listGames();
    if (remote.length > 0) return remote;
  } catch {
    // fall back to local
  }
  return local.listGames();
}

export async function deleteGame(id: string): Promise<void> {
  await local.deleteGame(id);
  try {
    await api.deleteGame(id);
  } catch {
    // ignore remote delete failure
  }
}
