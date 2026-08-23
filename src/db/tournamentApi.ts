import { API_BASE, authHeaders, safeJson } from './apiClient';

export type TournamentStatus = 'scheduled' | 'active' | 'finished';

export interface TournamentSummary {
  id: number;
  name: string;
  createdBy: number;
  boardSize: number;
  timeControlBaseMs: number;
  timeControlIncrementMs: number;
  rated: boolean;
  berserkEnabled: boolean;
  startsAt: number;
  durationMin: number;
  finishesAt: number;
  status: TournamentStatus;
  winnerUserId: number | null;
  scheduleId: number | null;
  createdAt: number;
}

export interface TournamentSchedule {
  id: number;
  freq: 'daily' | 'weekly';
  utcWeekday: number | null;
  utcMinute: number;
  active: boolean;
}

export interface TournamentStanding {
  rank: number;
  userId: number;
  username: string;
  rating: number;
  country: string;
  score: number;
  streak: number;
  gamesPlayed: number;
  paused: boolean;
  playing: boolean;
}

export interface TournamentMyStatus {
  joined: boolean;
  paused: boolean;
  currentRoomId: number | null;
}

export interface TournamentDetail {
  tournament: TournamentSummary;
  standings: TournamentStanding[];
  me: TournamentMyStatus | null;
  schedule: TournamentSchedule | null;
}

export async function getTournaments(): Promise<TournamentSummary[]> {
  const res = await fetch(`${API_BASE}/api/tournaments`, { headers: authHeaders(false) });
  return safeJson<TournamentSummary[]>(res);
}

export async function getTournament(id: number): Promise<TournamentDetail> {
  const res = await fetch(`${API_BASE}/api/tournaments/${id}`, { headers: authHeaders(false) });
  return safeJson<TournamentDetail>(res);
}

export async function createTournament(params: {
  name: string;
  startsAt: number;
  durationMin: number;
  boardSize: number;
  berserk: boolean;
  stateJson: string;
  treeJson: string;
}): Promise<{ id: number }> {
  const res = await fetch(`${API_BASE}/api/tournaments`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || 'Ошибка создания турнира');
  }
  return safeJson(res);
}

export async function createSchedule(params: {
  name: string;
  freq: 'daily' | 'weekly';
  firstStartAt: number;
  durationMin: number;
  boardSize: number;
  berserk: boolean;
  stateJson: string;
  treeJson: string;
}): Promise<{ scheduleId: number }> {
  const res = await fetch(`${API_BASE}/api/tournaments/schedules`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || 'Ошибка создания серии');
  }
  return safeJson(res);
}

async function mutate(path: string, method: 'PUT' | 'DELETE', body?: unknown): Promise<void> {
  const res = await fetch(`${API_BASE}/api/tournaments/${path}`, {
    method,
    headers: body ? authHeaders() : authHeaders(false),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || 'Ошибка');
  }
}

export const updateTournament = (id: number, body: {
  name: string; startsAt: number; durationMin: number; boardSize: number; berserk: boolean;
}) => mutate(`${id}`, 'PUT', body);

export const deleteTournament = (id: number) => mutate(`${id}`, 'DELETE');

export const updateSchedule = (id: number, body: {
  name: string; freq: 'daily' | 'weekly'; firstStartAt: number; durationMin: number; boardSize: number; berserk: boolean;
}) => mutate(`schedules/${id}`, 'PUT', body);

export const deleteSchedule = (id: number) => mutate(`schedules/${id}`, 'DELETE');

async function post(id: number, action: 'join' | 'pause' | 'resume'): Promise<void> {
  const res = await fetch(`${API_BASE}/api/tournaments/${id}/${action}`, {
    method: 'POST',
    headers: authHeaders(false),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || 'Ошибка');
  }
}

export const joinTournament = (id: number) => post(id, 'join');
export const pauseTournament = (id: number) => post(id, 'pause');
export const resumeTournament = (id: number) => post(id, 'resume');
