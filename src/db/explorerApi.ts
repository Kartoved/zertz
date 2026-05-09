import { API_BASE, authHeaders } from './apiClient';
import type { Move } from '../game/types';

export interface ExplorerMoveStat {
  moveNotation: string;
  move: Move;
  total: number;
  player1Wins: number;
  player2Wins: number;
  draws: number;
}

export interface ExplorerGameRef {
  gameId: number;
  ply: number;
  moveNotation: string;
  winner: number | null;
  user1Id: number | null;
  user2Id: number | null;
  playedAt: string;
}

export interface ExplorerLookupResult {
  moves: ExplorerMoveStat[];
  games: ExplorerGameRef[];
}

export interface ExplorerLookupParams {
  hash: string;
  boardSize: 37 | 48 | 61;
  playerId?: number | null;
}

export async function lookupExplorerPosition(
  params: ExplorerLookupParams
): Promise<ExplorerLookupResult> {
  const url = new URL(`${API_BASE}/api/explorer/lookup`, window.location.origin);
  url.searchParams.set('hash', params.hash);
  url.searchParams.set('boardSize', String(params.boardSize));
  if (params.playerId != null) url.searchParams.set('playerId', String(params.playerId));

  const res = await fetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) throw new Error(`explorer lookup failed: ${res.status}`);
  return res.json();
}
