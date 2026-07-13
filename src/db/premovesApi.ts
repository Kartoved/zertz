import { PreMovesByPlayer, PreMoveNotice, PreMoveTree } from '../game/types';
import { API_BASE, authHeaders } from './apiClient';

export interface PremovesFetchResult {
  trees: PreMovesByPlayer;
  notice: PreMoveNotice | null;
}

const EMPTY: PremovesFetchResult = { trees: { player1: null, player2: null }, notice: null };

export async function getPremoves(roomId: number | string): Promise<PremovesFetchResult> {
  const response = await fetch(`${API_BASE}/api/rooms/${roomId}/premoves`, {
    headers: authHeaders(false),
  });
  if (!response.ok) return EMPTY;
  const data = await response.json();
  return {
    trees: {
      player1: data && typeof data.player1 === 'object' ? data.player1 : null,
      player2: data && typeof data.player2 === 'object' ? data.player2 : null,
    },
    notice: data && data.notice && typeof data.notice === 'object' ? data.notice : null,
  };
}

// Persists the caller's own pre-move tree (server places it on the caller's
// side by auth). `null` clears it. Saving also clears any pending notice.
export async function setPremoves(
  roomId: number | string,
  tree: PreMoveTree | null
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/rooms/${roomId}/premoves`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ tree }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'serverError');
  }
}
