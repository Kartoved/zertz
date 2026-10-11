import { describe, it, expect } from 'vitest';
import { MAX_ZEN, validateBotGame } from './botGames.js';

const game = {
  player1: 'human', player2: 'greedy', boardSize: 48, winner: 'player2', winType: 'white',
  plies: 31, zen: '[ZIP "…"]\n1. Wd4 -a4 *', appVersion: '0.21.0',
};

describe('validateBotGame', () => {
  it('accepts a human-vs-bot and a bot-vs-bot game', () => {
    expect(validateBotGame(game)).toEqual({ ok: true, game });
    expect(validateBotGame({ ...game, player1: 'safe-random', winner: null, winType: null }).ok).toBe(true);
    expect(validateBotGame({ ...game, player1: 'fast-medium:forcing=8,defence=2' }).ok).toBe(true);
  });

  it('rejects a game without a bot, or with malformed fields', () => {
    expect(validateBotGame({ ...game, player2: 'human' })).toEqual({ ok: false, error: 'no bot in the game' });
    expect(validateBotGame({ ...game, player1: 'DROP TABLE' }).ok).toBe(false);
    expect(validateBotGame({ ...game, boardSize: 52 }).ok).toBe(false);
    expect(validateBotGame({ ...game, winner: 'player3' }).ok).toBe(false);
    expect(validateBotGame({ ...game, plies: -1 }).ok).toBe(false);
    expect(validateBotGame({ ...game, zen: 'x'.repeat(10) }).ok).toBe(false);
    expect(validateBotGame({ ...game, zen: `[${'x'.repeat(MAX_ZEN)}` }).ok).toBe(false);
    expect(validateBotGame(null).ok).toBe(false);
  });
});
