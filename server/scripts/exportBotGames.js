/**
 * Prints every game in `bot_games` (human vs bot, bot vs bot watched on the
 * site) as JSONL in the arena's MatchGame shape, so the bot's tools read them
 * like any recorded match: `npx vite-node scripts/gamestats.ts -- file.jsonl`.
 *
 *   node server/scripts/exportBotGames.js > site-bot-games.jsonl
 *
 * `a` is player1's side; each line also carries the sides and when it was played.
 */

import { pool } from '../db.js';

async function main() {
  const rows = await pool.query(
    `SELECT id, player1, player2, board_size, winner, win_type, plies, zen, app_version, created_at
       FROM bot_games ORDER BY id`,
  );
  for (const r of rows.rows) {
    const line = {
      index: r.id,
      aWasBlue: true,
      sides: { player1: r.player1, player2: r.player2 },
      boardSize: r.board_size,
      appVersion: r.app_version,
      playedAt: r.created_at,
      result: {
        winner: r.winner,
        winType: r.win_type,
        plies: r.plies,
        msByPlayer: { player1: 0, player2: 0 },
        cappedOut: false,
        zen: r.zen,
      },
    };
    process.stdout.write(JSON.stringify(line) + '\n');
  }
}

main()
  .catch(err => {
    console.error('[export-bot-games] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
