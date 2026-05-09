import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

/**
 * GET /api/explorer/lookup
 *   ?hash=abcdef0123456789       (required, 16 hex)
 *   &boardSize=37|48|61          (required)
 *   &playerId=42                 (optional — restrict to games involving user)
 *
 * Returns:
 *   {
 *     moves: [
 *       { moveNotation, move, total, player1Wins, player2Wins, draws }
 *     ],
 *     games: [
 *       { gameId, ply, moveNotation, winner, user1Id, user2Id, playedAt }
 *     ]
 *   }
 *
 * The aggregate counts in `moves` already collapse rotations/reflections
 * because indexing canonicalizes both position and move. When `playerId` is
 * given, the aggregate is computed live from the per-game table filtered
 * by player; otherwise the precomputed `position_moves` row is used.
 */
router.get('/lookup', async (req, res) => {
  const hash = String(req.query.hash || '').trim();
  const boardSize = parseInt(req.query.boardSize, 10);
  const playerId = req.query.playerId ? parseInt(req.query.playerId, 10) : null;

  if (!/^[0-9a-f]{16}$/.test(hash)) {
    return res.status(400).json({ error: 'bad_hash' });
  }
  if (![37, 48, 61].includes(boardSize)) {
    return res.status(400).json({ error: 'bad_board_size' });
  }
  if (playerId !== null && (!Number.isInteger(playerId) || playerId <= 0)) {
    return res.status(400).json({ error: 'bad_player_id' });
  }

  try {
    let moves;
    if (playerId === null) {
      // Fast path: read precomputed aggregates.
      const r = await pool.query(
        `SELECT move_notation, move_json, total_games, player1_wins, player2_wins, draws
           FROM position_moves
          WHERE position_hash = $1 AND board_size = $2
          ORDER BY total_games DESC, move_notation ASC`,
        [hash, boardSize]
      );
      moves = r.rows.map(row => ({
        moveNotation: row.move_notation,
        move: JSON.parse(row.move_json),
        total: row.total_games,
        player1Wins: row.player1_wins,
        player2Wins: row.player2_wins,
        draws: row.draws,
      }));
    } else {
      // Player-filtered: compute on the fly from the per-game table.
      const r = await pool.query(
        `SELECT
            move_notation,
            (ARRAY_AGG(move_json ORDER BY id))[1] AS move_json,
            COUNT(*)::int AS total_games,
            SUM(CASE WHEN winner = 1 THEN 1 ELSE 0 END)::int AS player1_wins,
            SUM(CASE WHEN winner = 2 THEN 1 ELSE 0 END)::int AS player2_wins,
            SUM(CASE WHEN winner IS NULL OR (winner <> 1 AND winner <> 2) THEN 1 ELSE 0 END)::int AS draws
           FROM position_games
          WHERE position_hash = $1 AND board_size = $2
            AND (user1_id = $3 OR user2_id = $3)
          GROUP BY move_notation
          ORDER BY total_games DESC, move_notation ASC`,
        [hash, boardSize, playerId]
      );
      moves = r.rows.map(row => ({
        moveNotation: row.move_notation,
        move: JSON.parse(row.move_json),
        total: row.total_games,
        player1Wins: row.player1_wins,
        player2Wins: row.player2_wins,
        draws: row.draws,
      }));
    }

    // Recent games passing through this position (drill-down list).
    let gamesQuery, gamesParams;
    if (playerId === null) {
      gamesQuery = `
        SELECT game_id, ply, move_notation, winner, user1_id, user2_id, played_at
          FROM position_games
         WHERE position_hash = $1 AND board_size = $2
         ORDER BY played_at DESC
         LIMIT 20`;
      gamesParams = [hash, boardSize];
    } else {
      gamesQuery = `
        SELECT game_id, ply, move_notation, winner, user1_id, user2_id, played_at
          FROM position_games
         WHERE position_hash = $1 AND board_size = $2
           AND (user1_id = $3 OR user2_id = $3)
         ORDER BY played_at DESC
         LIMIT 20`;
      gamesParams = [hash, boardSize, playerId];
    }
    const gr = await pool.query(gamesQuery, gamesParams);
    const games = gr.rows.map(row => ({
      gameId: row.game_id,
      ply: row.ply,
      moveNotation: row.move_notation,
      winner: row.winner,
      user1Id: row.user1_id,
      user2Id: row.user2_id,
      playedAt: row.played_at,
    }));

    res.json({ moves, games });
  } catch (err) {
    console.error('[explorer] lookup error:', err);
    res.status(500).json({ error: 'serverError' });
  }
});

export default router;
