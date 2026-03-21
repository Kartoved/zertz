import { GameState, GameNode } from '../game/types';
import { API_BASE, authHeaders, safeJson, serializeState, deserializeState, serializeTree, deserializeTree } from './apiClient';

type SavedGameSummary = {
  id: string;
  playerNames: { player1: string; player2: string };
  updatedAt: number;
  moveCount: number;
  winner: string | null;
  winType: string | null;
  boardSize: 37 | 48 | 61;
  isOnline: boolean;
};

function inferIsOnline(id: string, isOnline?: boolean): boolean {
  if (typeof isOnline === 'boolean') return isOnline;
  return /^\d+$/.test(id) && id.length <= 10;
}

export async function saveGame(
  id: string,
  state: GameState,
  tree: GameNode,
  playerNames: { player1: string; player2: string },
  winType: string | null,
  isOnline: boolean
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/games`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      id,
      playerNames,
      moveCount: state.moveNumber,
      winner: state.winner,
      winType,
      boardSize: state.boardSize,
      isOnline,
      stateJson: serializeState(state),
      treeJson: serializeTree(tree),
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to save game');
  }
}

export async function loadGame(id: string): Promise<{
  state: GameState;
  tree: GameNode;
  playerNames: { player1: string; player2: string };
  winType: string | null;
} | null> {
  const response = await fetch(`${API_BASE}/api/games/${id}`, { headers: authHeaders(false) });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error('Failed to load game');
  }

  const data = await safeJson<{
    stateJson: string;
    treeJson: string;
    playerNames: { player1: string; player2: string };
    winType: string | null;
  }>(response);
  return {
    state: deserializeState(data.stateJson),
    tree: deserializeTree(data.treeJson),
    playerNames: data.playerNames,
    winType: data.winType,
  };
}

export async function listGames(): Promise<SavedGameSummary[]> {
  const response = await fetch(`${API_BASE}/api/games`, { headers: authHeaders(false) });
  if (!response.ok) {
    throw new Error('Failed to list games');
  }
  const games = await safeJson<Array<Omit<SavedGameSummary, 'isOnline'> & { isOnline?: boolean }>>(response);
  return games.map((game) => ({
    ...game,
    isOnline: inferIsOnline(game.id, game.isOnline),
  }));
}

export async function deleteGame(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/games/${id}`, { method: 'DELETE', headers: authHeaders(false) });
  if (!response.ok) {
    throw new Error('Failed to delete game');
  }
}
