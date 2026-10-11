/**
 * Validates a finished bot game reported by the client. Pure, so it is tested
 * without a database. A side is `human` or a bot spec (src/ai/botSpec.ts:
 * `greedy`, `safe-random`, later `fast-medium:forcing=8`); at least one side
 * must be a bot.
 */

const SIDE = /^(human|[a-z][a-z0-9-]*(:[a-zA-Z0-9=.,_-]*)?)$/;
// A real game is 0.4–6 KB of ZEN; the cap bounds what one request can store.
export const MAX_ZEN = 20_000;

/** Rows accepted per 24 h across everyone (a day of fast bot-vs-bot watching is ~1000). */
export const DAILY_CAP = 2000;

/** The table stops growing here, whatever happens: the server's disk is 10 GB. */
export const MAX_TABLE_BYTES = 500 * 1024 * 1024;

export function validateBotGame(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'body required' };
  const { player1, player2, boardSize, winner = null, winType = null, plies, zen, appVersion = null } = body;

  for (const side of [player1, player2]) {
    if (typeof side !== 'string' || side.length > 64 || !SIDE.test(side)) return { ok: false, error: 'bad player' };
  }
  if (player1 === 'human' && player2 === 'human') return { ok: false, error: 'no bot in the game' };
  if (![37, 48, 61].includes(boardSize)) return { ok: false, error: 'bad boardSize' };
  if (winner !== null && winner !== 'player1' && winner !== 'player2') return { ok: false, error: 'bad winner' };
  if (winType !== null && (typeof winType !== 'string' || winType.length > 32)) return { ok: false, error: 'bad winType' };
  if (!Number.isInteger(plies) || plies < 0 || plies > 1000) return { ok: false, error: 'bad plies' };
  if (typeof zen !== 'string' || zen.length === 0 || zen.length > MAX_ZEN || !zen.trimStart().startsWith('[')) {
    return { ok: false, error: 'bad zen' };
  }
  if (appVersion !== null && (typeof appVersion !== 'string' || appVersion.length > 16)) return { ok: false, error: 'bad appVersion' };

  return { ok: true, game: { player1, player2, boardSize, winner, winType, plies, zen, appVersion } };
}
