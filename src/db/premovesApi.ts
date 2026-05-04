import { PreMoveVariant } from '../game/types';
import { API_BASE, authHeaders } from './apiClient';

export async function getPremoves(roomId: number | string): Promise<PreMoveVariant[]> {
  const response = await fetch(`${API_BASE}/api/rooms/${roomId}/premoves`, {
    headers: authHeaders(false),
  });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data.variants) ? data.variants : [];
}

export async function setPremoves(
  roomId: number | string,
  variants: PreMoveVariant[]
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/rooms/${roomId}/premoves`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ variants }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'serverError');
  }
}
