import { GameState, GameNode } from '../game/types';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function safeJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Non-JSON response');
  }
  return response.json() as Promise<T>;
}

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

function serializeState(state: GameState): string {
  const obj = {
    ...state,
    rings: Array.from(state.rings.entries()),
  };
  return JSON.stringify(obj);
}

function deserializeState(json: string): GameState {
  const obj = JSON.parse(json);
  return {
    ...obj,
    rings: new Map(obj.rings),
  };
}

function serializeTree(node: GameNode): string {
  function serializeNode(n: GameNode): object {
    return {
      ...n,
      parent: null,
      children: n.children.map(c => serializeNode(c)),
    };
  }
  return JSON.stringify(serializeNode(node));
}

function deserializeTree(json: string): GameNode {
  const obj = JSON.parse(json);

  function rebuildNode(n: object, parent: GameNode | null): GameNode {
    const node = n as GameNode;
    node.parent = parent;
    node.children = (node.children || []).map((c: object) => rebuildNode(c, node));
    return node;
  }

  return rebuildNode(obj, null);
}

export async function saveGame(
  id: string,
  state: GameState,
  tree: GameNode,
  playerNames: { player1: string; player2: string },
  winType: string | null,
  isOnline: boolean
): Promise<void> {
  const token = localStorage.getItem('zertz_auth_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}/api/games`, {
    method: 'POST',
    headers,
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
  const token = localStorage.getItem('zertz_auth_token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}/api/games/${id}`, { headers });
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
  const token = localStorage.getItem('zertz_auth_token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}/api/games`, { headers });
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
  const token = localStorage.getItem('zertz_auth_token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}/api/games/${id}`, { method: 'DELETE', headers });
  if (!response.ok) {
    throw new Error('Failed to delete game');
  }
}
