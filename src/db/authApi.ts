const API_BASE = import.meta.env.VITE_API_URL || '';

export interface User {
  id: number;
  username: string;
  quote: string;
  country: string;
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

function getAuthHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function register(username: string, password: string): Promise<{ token: string; user: User }> {
  const response = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
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
    headers: getAuthHeader(token),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Ошибка получения профиля');
  }
  return data;
}

export async function updateProfile(
  token: string,
  updates: { quote?: string; country?: string; oldPassword?: string; newPassword?: string }
): Promise<User> {
  const response = await fetch(`${API_BASE}/api/auth/profile`, {
    method: 'PUT',
    headers: getAuthHeader(token),
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
