/**
 * Finished games with a bot in them, reported by the client (gameStore) — the
 * corpus the bot's measuring tools replay. Write-only from the site: the data
 * is read straight from the database (or a dump) by the author's scripts.
 */

import { Router } from 'express';
import { pool } from '../db.js';
import { optionalAuth } from '../middleware/auth.js';
import { botGameLimiter } from '../middleware/rateLimits.js';
import { validateBotGame } from '../utils/botGames.js';

const router = Router();

router.post('/', botGameLimiter, optionalAuth, async (req, res) => {
  const checked = validateBotGame(req.body);
  if (!checked.ok) {
    res.status(400).json({ error: checked.error });
    return;
  }
  const g = checked.game;
  try {
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
