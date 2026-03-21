import { GameState, GameNode } from '../game/types';

export const API_BASE = import.meta.env.VITE_API_URL || '';

export function getToken(): string | null {
  return localStorage.getItem('zertz_auth_token');
}

export function authHeaders(contentType = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (contentType) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export function jsonHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json' };
}

export async function safeJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Non-JSON response');
  }
  return response.json() as Promise<T>;
}

export function serializeState(state: GameState): string {
  const ringsArray = Array.from(state.rings.entries());
  return JSON.stringify({ ...state, rings: ringsArray });
}

export function deserializeState(json: string): GameState {
  const parsed = JSON.parse(json);
  parsed.rings = new Map(parsed.rings);
  if (!parsed.captures) {
    parsed.captures = {
      player1: { white: 0, gray: 0, black: 0 },
      player2: { white: 0, gray: 0, black: 0 },
    };
  } else {
    if (!parsed.captures.player1) parsed.captures.player1 = { white: 0, gray: 0, black: 0 };
    if (!parsed.captures.player2) parsed.captures.player2 = { white: 0, gray: 0, black: 0 };
  }
  return parsed as GameState;
}

export function serializeTree(node: GameNode): string {
  function serializeNode(n: GameNode): object {
    return {
      ...n,
      parent: null,
      children: n.children.map(c => serializeNode(c)),
    };
  }
  return JSON.stringify(serializeNode(node));
}

export function deserializeTree(json: string): GameNode {
  const obj = JSON.parse(json);

  function rebuildNode(n: object, parent: GameNode | null): GameNode {
    const node = n as GameNode;
    node.parent = parent;
    node.children = (node.children || []).map((c: object) => rebuildNode(c, node));
    return node;
  }

  return rebuildNode(obj, null);
}
