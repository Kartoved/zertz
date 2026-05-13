import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

const QUEUE_TTL_MS = 10 * 60 * 1000; // 10 min — abandon stale entries

const BASE_MS = {
  blitz: 5 * 60 * 1000,
  rapid: 15 * 60 * 1000,
  long: 30 * 60 * 1000,
  correspondence: 7 * 24 * 60 * 60 * 1000,
};
const INC_MS = {
  blitz: 5 * 1000,
  rapid: 0,
  long: 0,
  correspondence: -1,
};

router.post('/join', authRequired, async (req, res) => {
  const { boardSize, timeControl, stateJson, treeJson } = req.body;
  const userId = Number(req.user.id);

  if (!boardSize || !timeControl) {
    res.status(400).json({ error: 'Missing parameters' });
    return;
  }

  const uResult = await pool.query('SELECT rating FROM users WHERE id = $1', [userId]);
  if (uResult.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const rating = uResult.rows[0].rating;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Purge stale queue entries (older than TTL) so they don't clog matching.
    await client.query(
      `DELETE FROM matchmaking_queue WHERE joined_at < NOW() - $1::interval`,
      [`${QUEUE_TTL_MS} milliseconds`]
    );

    // Adaptive rating tolerance: expand by 50 pts/s waited, up to 1000.
    // We compute it per candidate inside the WHERE clause using an expression.
    const candidate = await client.query(
      `SELECT user_id, state_json, tree_json, rating, joined_at
         FROM matchmaking_queue
        WHERE board_size   = $1
          AND time_control = $2
          AND user_id     <> $3
          AND ABS(rating - $4) <=
              (200 + LEAST(1000,
                FLOOR(EXTRACT(EPOCH FROM (NOW() - joined_at)) * 50)
              ))
        ORDER BY joined_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED`,
      [boardSize, timeControl, userId, rating]
    );

    if (candidate.rows.length > 0) {
      const other = candidate.rows[0];
      const otherId = other.user_id;

      const cBase = BASE_MS[timeControl] ?? null;
      const cInc = INC_MS[timeControl] ?? null;

      const roomRes = await client.query(
        `INSERT INTO rooms (
           board_size, creator_player, state_json, tree_json, rated,
           user1_id, user2_id,
           time_control_base_ms, time_control_increment_ms,
           clock_p1_ms, clock_p2_ms, clock_running_since
         )
         VALUES ($1, 1, $2, $3, true, $4, $5, $6, $7, $8, $9, null)
         RETURNING id`,
        [boardSize, other.state_json, other.tree_json, otherId, userId,
         cBase, cInc, cBase, cBase]
      );
      const roomId = roomRes.rows[0].id;

      // Remove the matched user from the queue.
      await client.query('DELETE FROM matchmaking_queue WHERE user_id = $1', [otherId]);
      // Remove the new joiner from the queue if they were already in it.
      await client.query('DELETE FROM matchmaking_queue WHERE user_id = $1', [userId]);

      // Store results for both so their next /status poll returns the roomId.
      await client.query(
        `INSERT INTO matchmaking_results (user_id, room_id)
         VALUES ($1, $2), ($3, $2)
         ON CONFLICT (user_id) DO UPDATE SET room_id = EXCLUDED.room_id, matched_at = NOW()`,
        [userId, roomId, otherId]
      );

      await client.query('COMMIT');
      res.json({ status: 'matched', roomId });
      return;
    }

    // No match found — upsert into queue.
    await client.query(
      `INSERT INTO matchmaking_queue (user_id, board_size, time_control, rating, state_json, tree_json)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE
         SET board_size   = EXCLUDED.board_size,
             time_control = EXCLUDED.time_control,
             rating       = EXCLUDED.rating,
             state_json   = EXCLUDED.state_json,
             tree_json    = EXCLUDED.tree_json,
             joined_at    = NOW()`,
      [userId, boardSize, timeControl, rating, stateJson, treeJson]
    );

    await client.query('COMMIT');
    res.json({ status: 'searching' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Matchmaking join error:', err);
    res.status(500).json({ error: 'Matchmaking error' });
  } finally {
    client.release();
  }
});

router.get('/status', authRequired, async (req, res) => {
  const userId = Number(req.user.id);

  const result = await pool.query(
    'SELECT room_id FROM matchmaking_results WHERE user_id = $1',
    [userId]
  );
  if (result.rows.length > 0) {
    const roomId = result.rows[0].room_id;
    // Consume the result — client has acknowledged.
    await pool.query('DELETE FROM matchmaking_results WHERE user_id = $1', [userId]);
    res.json({ status: 'matched', roomId });
    return;
  }

  const inQueue = await pool.query(
    'SELECT 1 FROM matchmaking_queue WHERE user_id = $1',
    [userId]
  );
  if (inQueue.rows.length > 0) {
    res.json({ status: 'searching' });
    return;
  }

  res.json({ status: 'none' });
});

router.delete('/leave', authRequired, async (req, res) => {
  const userId = Number(req.user.id);
  await pool.query('DELETE FROM matchmaking_queue   WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM matchmaking_results WHERE user_id = $1', [userId]);
  res.json({ status: 'left' });
});

export default router;
