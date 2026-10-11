/**
 * Finished games with a bot in them, reported by the client (gameStore) — the
 * corpus the bot's measuring tools replay. Write-only from the site: the data
 * is read straight from the database (or a dump) by the author's scripts.
 */

import { Router } from 'express';
import { pool } from '../db.js';
import { optionalAuth } from '../middleware/auth.js';
import { botGameLimiter } from '../middleware/rateLimits.js';
import { DAILY_CAP, MAX_TABLE_BYTES, validateBotGame } from '../utils/botGames.js';

const router = Router();

router.post('/', botGameLimiter, optionalAuth, async (req, res) => {
  const checked = validateBotGame(req.body);
  if (!checked.ok) {
    res.status(400).json({ error: checked.error });
    return;
  }
  const g = checked.game;
  try {
    // Anyone may report (guests' games count too), so beyond the per-IP limit
    // the table is capped per day and in total: spam can waste a quota, never the disk.
    const usage = await pool.query(
      `SELECT (SELECT count(*)::int FROM bot_games WHERE created_at > NOW() - INTERVAL '1 day') AS today,
              pg_total_relation_size('bot_games') AS bytes`,
    );
    if (usage.rows[0].today >= DAILY_CAP || Number(usage.rows[0].bytes) >= MAX_TABLE_BYTES) {
      res.status(429).json({ error: 'Bot game quota reached' });
      return;
    }
    const result = await pool.query(
      `INSERT INTO bot_games (user_id, player1, player2, board_size, winner, win_type, plies, zen, app_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [req.user?.id ?? null, g.player1, g.player2, g.boardSize, g.winner, g.winType, g.plies, g.zen, g.appVersion],
    );
    res.json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    console.error('Save bot game error:', err);
    res.status(500).json({ error: 'Failed to save bot game' });
  }
});

export default router;
