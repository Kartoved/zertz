import { API_BASE, authHeaders, safeJson } from './apiClient';

export interface LobbySlot {
  id: number;
  userId: number;
  username: string;
  rating: number;
  country: string;
  boardSize: number;
  timeControlId: string;
  timeControlBaseMs: number | null;
  timeControlIncrementMs: number | null;
  rated: boolean;
  status: 'open' | 'joined';
  roomId: number | null;
  createdAt: number;
  expiresAt: number;
}

export async function getLobbySlots(): Promise<LobbySlot[]> {
  const res = await fetch(`${API_BASE}/api/lobby`, { headers: authHeaders(false) });
  return safeJson<LobbySlot[]>(res);
}

export async function createLobbySlot(params: {
  boardSize: number;
  timeControlId: string;
  timeControlBaseMs: number | null;
  timeControlIncrementMs: number | null;
  rated: boolean;
  stateJson: string;
  treeJson: string;
}): Promise<{ id: number; expiresAt: number }> {
  const res = await fetch(`${API_BASE}/api/lobby`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || 'Ошибка создания слота');
  }
  return safeJson(res);
}

export async function deleteMyLobbySlot(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/lobby/my`, {
    method: 'DELETE',
    headers: authHeaders(false),
  });
  if (!res.ok) throw new Error('Ошибка удаления слота');
}

export async function joinLobbySlot(slotId: number): Promise<{ roomId: number }> {
  const res = await fetch(`${API_BASE}/api/lobby/${slotId}/join`, {
    method: 'POST',
    headers: authHeaders(false),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || 'Ошибка присоединения');
  }
  return safeJson(res);
}
