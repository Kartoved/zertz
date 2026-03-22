import { API_BASE, getToken, authHeaders, jsonHeaders } from './apiClient';

export interface User {
  id: number;
  username: string;
  quote: string;
  country: string;
  contactLink: string;
  rating: number;
  ratingRd: number;
  wins: number;
  losses: number;
  bestStreak: number;
  currentStreak: number;
  createdAt: number;
}

export interface PlayerInfo {
  id: number;
  username: string;
  country: string;
  rating: number;
  wins: number;
  losses: number;
  games: number;
  winrate: number;
  bestStreak: number;
  createdAt: number;
}

export async function register(username: string, password: string): Promise<{ token: string; user: User }> {
  const response = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Ошибка регистрации');
  }
  return data;
}

export async function login(username: string, password: string): Promise<{ token: string; user: User }> {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Ошибка входа');
  }
  return data;
}

export async function getMe(token: string): Promise<User> {
  const response = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Ошибка получения профиля');
  }
  return data;
}

export async function updateProfile(
  token: string,
  updates: { quote?: string; country?: string; contactLink?: string; oldPassword?: string; newPassword?: string }
): Promise<User> {
  const response = await fetch(`${API_BASE}/api/auth/profile`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Ошибка обновления профиля');
  }
  return data;
}

export async function getPlayers(sort = 'rating', order = 'desc'): Promise<PlayerInfo[]> {
  const response = await fetch(`${API_BASE}/api/players?sort=${sort}&order=${order}`);

  if (!response.ok) {
    throw new Error('Ошибка получения списка игроков');
  }
  return response.json();
}

// ==================== Player Profile ====================

export interface PlayerProfile {
  id: number;
  username: string;
  quote: string;
  country: string;
  contactLink: string;
  rating: number;
  ratingRd: number;
  wins: number;
  losses: number;
  games: number;
  winrate: number;
  bestStreak: number;
  currentStreak: number;
  createdAt: number;
  isFollowing: boolean;
}

export async function getPlayerProfile(playerId: number): Promise<PlayerProfile> {
  const response = await fetch(`${API_BASE}/api/players/${playerId}`, { headers: authHeaders(false) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Ошибка получения профиля игрока');
  return data;
}

// ==================== Follows ====================

export async function followUser(userId: number): Promise<void> {
  if (!getToken()) throw new Error('Требуется авторизация');

  const response = await fetch(`${API_BASE}/api/follows/${userId}`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Ошибка подписки');
  }
}

export async function unfollowUser(userId: number): Promise<void> {
  if (!getToken()) throw new Error('Требуется авторизация');

  const response = await fetch(`${API_BASE}/api/follows/${userId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Ошибка отписки');
  }
}

export async function getFollowing(): Promise<PlayerInfo[]> {
  if (!getToken()) throw new Error('Требуется авторизация');

  const response = await fetch(`${API_BASE}/api/follows`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error('Ошибка получения подписок');
  return response.json();
}

export async function getFollowIds(): Promise<number[]> {
  if (!getToken()) return [];

  const response = await fetch(`${API_BASE}/api/follows/ids`, {
    headers: authHeaders(),
  });
  if (!response.ok) return [];
  return response.json();
}

// ==================== Challenges ====================

export interface Challenge {
  id: number;
  fromUserId: number;
  toUserId: number;
  fromUsername: string;
  fromRating: number;
  fromCountry: string;
  toUsername: string;
  toRating: number;
  toCountry: string;
  roomId: number;
  boardSize: number;
  rated: boolean;
  status: string;
  createdAt: number;
}

export async function createChallenge(
  toUserId: number,
  boardSize: number,
  rated: boolean,
  creatorPlayer: 1 | 2,
  stateJson: string,
  treeJson: string
): Promise<{ id: number; roomId: number }> {
  if (!getToken()) throw new Error('Требуется авторизация');

  const response = await fetch(`${API_BASE}/api/challenges`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ toUserId, boardSize, rated, creatorPlayer, stateJson, treeJson }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Ошибка создания вызова');
  return data;
}

export async function cancelChallenge(challengeId: number): Promise<void> {
  if (!getToken()) throw new Error('Требуется авторизация');

  const response = await fetch(`${API_BASE}/api/challenges/${challengeId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Ошибка отмены вызова');
  }
}

export async function acceptChallenge(challengeId: number): Promise<{ roomId: number }> {
  if (!getToken()) throw new Error('Требуется авторизация');

  const response = await fetch(`${API_BASE}/api/challenges/${challengeId}/accept`, {
    method: 'PUT',
    headers: authHeaders(),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Ошибка принятия вызова');
  return data;
}

export async function declineChallenge(challengeId: number): Promise<void> {
  if (!getToken()) throw new Error('Требуется авторизация');

  const response = await fetch(`${API_BASE}/api/challenges/${challengeId}/decline`, {
    method: 'PUT',
    headers: authHeaders(),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Ошибка отклонения вызова');
  }
}

export async function getChallenges(): Promise<Challenge[]> {
  if (!getToken()) return [];

  const response = await fetch(`${API_BASE}/api/challenges`, {
    headers: authHeaders(),
  });
  if (!response.ok) return [];
  return response.json();
}
