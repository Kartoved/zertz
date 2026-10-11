/**
 * What the site offers: levels for a person to play against, and the bots a
 * person can watch play each other. Every entry is a bot spec (botSpec.ts), so
 * a game played here names exactly the bot that played it — which is what makes
 * the saved games (POST /api/bot-games) usable by the measuring tools.
 */

import type { Player } from '../game/types';
import type { Dict } from '../i18n';

export type BotSides = Record<Player, string | null>;

export interface BotGameConfig {
  boardSize: 37 | 48 | 61;
  /** The bot spec playing each side; null for the human. */
  bots: BotSides;
  /** Bot-vs-bot pacing: the least time between two moves, so a person can follow. */
  delayMs: number;
}

/** Strongest last. `strong` is the search bot to come. */
export const PLAY_LEVELS = [
  { id: 'novice', spec: 'safe-random' },
  { id: 'amateur', spec: 'greedy' },
] as const;

export const WATCH_BOTS = ['greedy', 'safe-random', 'minimax-easy', 'random'] as const;

export const BOT_SPEEDS = [
  { id: 'fast', ms: 250 },
  { id: 'normal', ms: 900 },
  { id: 'slow', ms: 2000 },
] as const;

/** How a person plays against a bot: the bot answers almost at once, but not instantly. */
export const VS_HUMAN_DELAY_MS = 350;

export function botLabel(t: Dict, spec: string): string {
  switch (spec) {
    case 'random': return t.botNameRandom;
    case 'safe-random': return t.botNameSafeRandom;
    case 'minimax-easy': return t.botNameMinimaxEasy;
    case 'greedy': return t.botNameGreedy;
    default: return spec;
  }
}
