import { GameState, GameNode } from '../game/types';

const API_BASE = import.meta.env.VITE_API_URL || '';

export interface RatingDelta {
  player1: { before: number; after: number; delta: number };
  player2: { before: number; after: number; delta: number };
}

export interface FischerTimeControl {
  baseMs: number;
  incrementMs: number;
}

export interface RoomData {
  id: number;
  boardSize: 37 | 48 | 61;
  currentPlayer: 1 | 2;
  creatorPlayer: 1 | 2;
  winner: number | null;
  winType: string | null;
  stateJson: string;
  treeJson: string;
  playerNames: { player1: string; player2: string };
  createdAt: number;
  updatedAt: number;
  rated: boolean;
  user1Id: number | null;
  user2Id: number | null;
  user1Rating: number | null;
  user2Rating: number | null;
  ratingDelta: RatingDelta | null;
  timeControlBaseMs: number | null;
  timeControlIncrementMs: number | null;
  clockP1Ms: number | null;
  clockP2Ms: number | null;
  clockRunningSince: number | null;
}

export interface ChatMessage {
  id: number;
  playerIndex: 1 | 2;
  message: string;
  createdAt: number;
}

function serializeState(state: GameState): string {
  const ringsArray = Array.from(state.rings.entries());
  return JSON.stringify({ ...state, rings: ringsArray });
}

function deserializeState(json: string): GameState {
  const parsed = JSON.parse(json);
  parsed.rings = new Map(parsed.rings);
  return parsed as GameState;
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

  function rebuildNode(n: any, parent: GameNode | null): GameNode {
    const node = n as GameNode;
    node.parent = parent;
    node.children = (node.children || []).map((c: any) => rebuildNode(c, node));
    return node;
  }

  return rebuildNode(obj, null);
}

export async function createRoom(
  boardSize: 37 | 48 | 61,
  state: GameState,
  tree: GameNode,
  creatorPlayer: 1 | 2 = 1,
  rated: boolean = false,
  timeControl?: FischerTimeControl | null
): Promise<number> {
  const token = localStorage.getItem('zertz_auth_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}/api/rooms`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      boardSize,
      creatorPlayer,
      stateJson: serializeState(state),
      treeJson: serializeTree(tree),
      rated,
      timeControlBaseMs: timeControl?.baseMs ?? null,
      timeControlIncrementMs: timeControl?.incrementMs ?? null,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to create room');
  }

  const data = await response.json();
  return data.id;
}

export async function getRoom(id: number | string): Promise<{
  state: GameState;
  tree: GameNode;
  currentPlayer: 1 | 2;
  creatorPlayer: 1 | 2;
  user1Id: number | null;
  user2Id: number | null;
  winner: number | null;
  winType: string | null;
  playerNames: { player1: string; player2: string };
  boardSize: 37 | 48 | 61;
  updatedAt: number;
  rated: boolean;
  user1Rating: number | null;
  user2Rating: number | null;
  ratingDelta: RatingDelta | null;
  timeControlBaseMs: number | null;
  timeControlIncrementMs: number | null;
  clockP1Ms: number | null;
  clockP2Ms: number | null;
  clockRunningSince: number | null;
} | null> {
  const response = await fetch(`${API_BASE}/api/rooms/${id}`);
  
  if (response.status === 404) {
    return null;
  }
  
  if (!response.ok) {
    throw new Error('Failed to get room');
  }

  const data: RoomData = await response.json();
  return {
    state: deserializeState(data.stateJson),
    tree: deserializeTree(data.treeJson),
    currentPlayer: data.currentPlayer,
    creatorPlayer: data.creatorPlayer || 1,
    user1Id: data.user1Id,
    user2Id: data.user2Id,
    winner: data.winner,
    winType: data.winType,
    playerNames: data.playerNames,
    boardSize: data.boardSize,
    updatedAt: data.updatedAt,
    rated: data.rated || false,
    user1Rating: data.user1Rating,
    user2Rating: data.user2Rating,
    ratingDelta: data.ratingDelta,
    timeControlBaseMs: data.timeControlBaseMs,
    timeControlIncrementMs: data.timeControlIncrementMs,
    clockP1Ms: data.clockP1Ms,
    clockP2Ms: data.clockP2Ms,
    clockRunningSince: data.clockRunningSince,
  };
}

export async function updateRoomState(
  id: number | string,
  state: GameState,
  tree: GameNode,
  currentPlayer: 1 | 2,
  winner: number | null,
  winType: string | null,
  playerIndex?: 1 | 2
): Promise<{ ratingDelta: RatingDelta | null }> {
  const token = localStorage.getItem('zertz_auth_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}/api/rooms/${id}/state`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      stateJson: serializeState(state),
      treeJson: serializeTree(tree),
      currentPlayer,
      winner,
      winType,
      playerIndex,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to update room state');
  }

  const data = await response.json();
  return { ratingDelta: data.ratingDelta || null };
}

export async function updatePlayerName(
  roomId: number | string,
  playerIndex: 1 | 2,
  name: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/rooms/${roomId}/players/${playerIndex}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error('Failed to update player name');
  }
}

export async function getChatMessages(
  roomId: number | string,
  afterId?: number
): Promise<ChatMessage[]> {
  const url = afterId
    ? `${API_BASE}/api/rooms/${roomId}/messages?after=${afterId}`
    : `${API_BASE}/api/rooms/${roomId}/messages`;
    
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error('Failed to get messages');
  }

  return response.json();
}

export async function sendChatMessage(
  roomId: number | string,
  playerIndex: 1 | 2,
  message: string
): Promise<ChatMessage> {
  const response = await fetch(`${API_BASE}/api/rooms/${roomId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerIndex, message }),
  });

  if (!response.ok) {
    throw new Error('Failed to send message');
  }

  return response.json();
}

export async function joinMatchmaking(boardSize: 37 | 48 | 61, timeControl: string): Promise<{ status: 'matched' | 'searching' | 'none', roomId?: number }> {
  const token = localStorage.getItem('zertz_auth_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}/api/matchmake/join`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ boardSize, timeControl }),
  });

  if (!response.ok) {
    throw new Error('Failed to join matchmaking');
  }

  return response.json();
}

export async function pollMatchStatus(): Promise<{ status: 'matched' | 'searching' | 'none', roomId?: number }> {
  const token = localStorage.getItem('zertz_auth_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}/api/matchmake/status`, { headers });
  if (!response.ok) throw new Error('Failed to poll matchmaking');
  return response.json();
}

export async function leaveMatchmaking(): Promise<void> {
  const token = localStorage.getItem('zertz_auth_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  await fetch(`${API_BASE}/api/matchmake/leave`, { method: 'DELETE', headers });
}
