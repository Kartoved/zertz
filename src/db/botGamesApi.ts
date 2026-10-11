import { API_BASE, authHeaders } from './apiClient';

export interface BotGameReport {
  /** Bot spec (botSpec.ts) or 'human'. */
  player1: string;
  player2: string;
  boardSize: 37 | 48 | 61;
  winner: 'player1' | 'player2' | null;
  winType: string | null;
  plies: number;
  zen: string;
  appVersion: string;
}

/** Hands a finished bot game to the server for the bot's measuring tools. */
export async function saveBotGame(report: BotGameReport): Promise<void> {
  const response = await fetch(`${API_BASE}/api/bot-games`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(report),
  });
  if (!response.ok) throw new Error(`bot game not saved: ${response.status}`);
}
