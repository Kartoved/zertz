import { GameState, GameNode } from '../game/types';
import { API_BASE, authHeaders, serializeState, deserializeState, serializeTree, deserializeTree } from './apiClient';

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
  setupJson: string | null;
}

export interface ChatMessage {
  id: number;
  playerIndex: 1 | 2;
  message: string;
  moveNumber?: number;
  createdAt: number;
}

export async function createRoom(
  boardSize: 37 | 48 | 61,
  state: GameState,
  tree: GameNode,
  creatorPlayer: 1 | 2 = 1,
  rated: boolean = true,
  timeControl?: FischerTimeControl | null,
  setupJson?: string | null
): Promise<number> {
  const response = await fetch(`${API_BASE}/api/rooms`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      boardSize,
      creatorPlayer,
      stateJson: serializeState(state),
      treeJson: serializeTree(tree),
      rated,
      timeControlBaseMs: timeControl?.baseMs ?? null,
      timeControlIncrementMs: timeControl?.incrementMs ?? null,
      setupJson: setupJson ?? null,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to create room');
  }

  const data = await response.json();
  return data.id;
}

export async function getRoomHead(id: number | string): Promise<{ updatedAt: number; winner: number | null } | null> {
  const response = await fetch(`${API_BASE}/api/rooms/${id}/head`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Failed to get room head');
  return response.json();
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
  setupJson: string | null;
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
    setupJson: data.setupJson ?? null,
  };
}

export async function updateRoomState(
  id: number | string,
  state: GameState,
  tree: GameNode,
  currentPlayer: 1 | 2,
  winner: number | null,
  winType: string | null,
  _playerIndex?: 1 | 2, // server derives from auth; kept for call-site compatibility
  isUndo?: boolean
): Promise<{ ratingDelta: RatingDelta | null }> {
  const response = await fetch(`${API_BASE}/api/rooms/${id}/state`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({
      stateJson: serializeState(state),
      treeJson: serializeTree(tree),
      currentPlayer,
      winner,
      winType,
      isUndo: isUndo ?? false,
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
    headers: authHeaders(),
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
  _playerIndex: 1 | 2, // server derives from auth; arg kept for call-site compatibility
  message: string,
  moveNumber?: number
): Promise<ChatMessage> {
  const response = await fetch(`${API_BASE}/api/rooms/${roomId}/messages`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ message, moveNumber }),
  });

  if (!response.ok) {
    throw new Error('Failed to send message');
  }

  return response.json();
}

export async function joinMatchmaking(boardSize: 37 | 48 | 61, timeControl: string, state: GameState, tree: GameNode): Promise<{ status: 'matched' | 'searching' | 'none', roomId?: number }> {
  const response = await fetch(`${API_BASE}/api/matchmake/join`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ 
      boardSize, 
      timeControl, 
      stateJson: serializeState(state), 
      treeJson: serializeTree(tree) 
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to join matchmaking');
  }

  return response.json();
}

export async function pollMatchStatus(): Promise<{ status: 'matched' | 'searching' | 'none', roomId?: number }> {
  const response = await fetch(`${API_BASE}/api/matchmake/status`, { headers: authHeaders() });
  if (!response.ok) throw new Error('Failed to poll matchmaking');
  return response.json();
}

export async function leaveMatchmaking(): Promise<void> {
  await fetch(`${API_BASE}/api/matchmake/leave`, { method: 'DELETE', headers: authHeaders() });
}

export interface PendingRoom {
  id: number;
  boardSize: number;
  creatorPlayer: number;
  player1Name: string;
  player2Name: string;
  rated: boolean;
  timeControlBaseMs: number | null;
  timeControlIncrementMs: number | null;
  createdAt: number;
  /** Creator's rating/country — populated by /open (others' rooms), absent on /pending. */
  creatorRating?: number | null;
  creatorCountry?: string | null;
}

export async function getPendingRooms(): Promise<PendingRoom[]> {
  const response = await fetch(`${API_BASE}/api/rooms/pending`, { headers: authHeaders(false) });
  if (!response.ok) return [];
  return response.json();
}

export async function getOpenRooms(): Promise<PendingRoom[]> {
  const response = await fetch(`${API_BASE}/api/rooms/open`);
  if (!response.ok) return [];
  return response.json();
}

export async function deleteRoom(id: number | string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/rooms/${id}`, {
    method: 'DELETE',
    headers: authHeaders(false),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete room');
  }
}

export async function getActiveRoomsForPlayer(username: string): Promise<Array<{
  id: string;
  playerNames: { player1: string; player2: string };
  updatedAt: number;
  moveCount: number;
  winner: null;
  winType: null;
  boardSize: 37 | 48 | 61;
  isOnline: true;
}>> {
  const response = await fetch(`${API_BASE}/api/rooms/active/${encodeURIComponent(username)}`);
  if (!response.ok) return [];
  return response.json();
}

// All active rooms across all players. Optional `username` narrows the list
// (equivalent to getActiveRoomsForPlayer but via the new query-string endpoint).
export async function getActiveRooms(username?: string): Promise<Array<{
  id: string;
  playerNames: { player1: string; player2: string };
  updatedAt: number;
  moveCount: number;
  winner: null;
  winType: null;
  boardSize: 37 | 48 | 61;
  isOnline: true;
}>> {
  const url = username
    ? `${API_BASE}/api/rooms/active?username=${encodeURIComponent(username)}`
    : `${API_BASE}/api/rooms/active`;
  const response = await fetch(url);
  if (!response.ok) return [];
  return response.json();
}

// ── ZERTZ TV ──────────────────────────────────────────────────────────────
export interface TvPlayerMeta {
  player1: string | null;
  player2: string | null;
}

export interface TvLiveGame {
  id: string;
  boardSize: 37 | 48 | 61;
  playerNames: { player1: string; player2: string };
  ratings: { player1: number | null; player2: number | null };
  countries: TvPlayerMeta;
  stateJson: string;
  timeControl: { baseMs: number | null; incMs: number | null };
  isCorrespondence: boolean;
  updatedAt: number;
}

export interface TvFallbackGame {
  id: string;
  boardSize: 37 | 48 | 61;
  playerNames: { player1: string; player2: string };
  ratings: { player1: number | null; player2: number | null };
  countries: TvPlayerMeta;
  stateJson: string;
  treeJson: string;
}

export interface TvResponse {
  live: TvLiveGame[];
  fallback: TvFallbackGame | null;
}

// Live games to broadcast on the main menu (ZERTZ TV). `fallback` is the most
// recent finished game, present only when nothing is currently live.
export async function getTvGames(): Promise<TvResponse> {
  const response = await fetch(`${API_BASE}/api/rooms/tv`, { headers: authHeaders(false) });
  if (!response.ok) return { live: [], fallback: null };
  return response.json();
}

export async function cancelGame(id: number | string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/rooms/${id}/cancel`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to cancel game');
  }
}

// Add time to the opponent's clock. Server decides the amount (+15s blitz /
// +1 day correspondence) and which clock to credit.
export async function addTime(id: number | string): Promise<{
  opponentPlayer: 1 | 2;
  deltaMs: number;
  clockP1Ms: number | null;
  clockP2Ms: number | null;
}> {
  const response = await fetch(`${API_BASE}/api/rooms/${id}/add-time`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to add time');
  }
  return response.json();
}
