import { GameState, GameNode } from '../game/types';

const API_BASE = import.meta.env.VITE_API_URL || '';

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
  return JSON.stringify(node);
}

function deserializeTree(json: string): GameNode {
  return JSON.parse(json) as GameNode;
}

export async function createRoom(
  boardSize: 37 | 48 | 61,
  state: GameState,
  tree: GameNode,
  creatorPlayer: 1 | 2 = 1
): Promise<number> {
  const response = await fetch(`${API_BASE}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      boardSize,
      creatorPlayer,
      stateJson: serializeState(state),
      treeJson: serializeTree(tree),
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
  winner: number | null;
  winType: string | null;
  playerNames: { player1: string; player2: string };
  boardSize: 37 | 48 | 61;
  updatedAt: number;
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
    winner: data.winner,
    winType: data.winType,
    playerNames: data.playerNames,
    boardSize: data.boardSize,
    updatedAt: data.updatedAt,
  };
}

export async function updateRoomState(
  id: number | string,
  state: GameState,
  tree: GameNode,
  currentPlayer: 1 | 2,
  winner: number | null,
  winType: string | null
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/rooms/${id}/state`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stateJson: serializeState(state),
      treeJson: serializeTree(tree),
      currentPlayer,
      winner,
      winType,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to update room state');
  }
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
