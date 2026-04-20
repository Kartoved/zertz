import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired, optionalAuth } from '../middleware/auth.js';
import { sendPushToUser } from '../utils/pushNotifications.js';

const router = Router();

// GET /api/lobby — list all open, non-expired slots
router.get('/', optionalAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, user_id, username, rating, country,
              board_size, time_control_id, time_control_base_ms, time_control_increment_ms,
              rated, status, room_id, created_at, expires_at
       FROM lobby_slots
       WHERE expires_at > NOW()
       ORDER BY created_at DESC`
    );
    res.json(result.rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      username: r.username,
      rating: Math.round(r.rating),
      country: r.country,
      boardSize: r.board_size,
      timeControlId: r.time_control_id,
      timeControlBaseMs: r.time_control_base_ms ? Number(r.time_control_base_ms) : null,
      timeControlIncrementMs: r.time_control_increment_ms !== null ? Number(r.time_control_increment_ms) : null,
      rated: r.rated,
      status: r.status,
      roomId: r.room_id,
      createdAt: r.created_at.getTime(),
      expiresAt: r.expires_at.getTime(),
    })));
  } catch (err) {
    console.error('GET /lobby error:', err);
    res.status(500).json({ error: 'Ошибка получения лобби' });
  }
});

// POST /api/lobby — create or replace own slot
router.post('/', authRequired, async (req, res) => {
  const { boardSize = 37, timeControlId = 'rapid', timeControlBaseMs = null,
          timeControlIncrementMs = null, rated = true, stateJson, treeJson } = req.body;
  if (!stateJson || !treeJson) {
    res.status(400).json({ error: 'Missing state or tree' });
    return;
  }

  const userId = req.user.id;
  try {
    const userRow = await pool.query(
      'SELECT username, rating, country FROM users WHERE id = $1',
      [userId]
    );
    if (userRow.rows.length === 0) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }
    const { username, rating, country } = userRow.rows[0];

    const result = await pool.query(
      `INSERT INTO lobby_slots
         (user_id, username, rating, country, board_size, time_control_id,
          time_control_base_ms, time_control_increment_ms, rated, state_json, tree_json,
          status, room_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'open', NULL, NOW() + INTERVAL '10 minutes')
       ON CONFLICT (user_id) DO UPDATE SET
         username = EXCLUDED.username,
         rating = EXCLUDED.rating,
         country = EXCLUDED.country,
         board_size = EXCLUDED.board_size,
         time_control_id = EXCLUDED.time_control_id,
         time_control_base_ms = EXCLUDED.time_control_base_ms,
         time_control_increment_ms = EXCLUDED.time_control_increment_ms,
         rated = EXCLUDED.rated,
         state_json = EXCLUDED.state_json,
         tree_json = EXCLUDED.tree_json,
         status = 'open',
         room_id = NULL,
         created_at = NOW(),
         expires_at = NOW() + INTERVAL '10 minutes'
       RETURNING id, expires_at`,
      [userId, username, Math.round(rating), country, boardSize, timeControlId,
       timeControlBaseMs, timeControlIncrementMs, rated, stateJson, treeJson]
    );

    res.json({
      id: result.rows[0].id,
      expiresAt: result.rows[0].expires_at.getTime(),
    });
  } catch (err) {
    console.error('POST /lobby error:', err);
    res.status(500).json({ error: 'Ошибка создания слота' });
  }
});

// DELETE /api/lobby/my — remove own slot
router.delete('/my', authRequired, async (req, res) => {
  try {
    await pool.query('DELETE FROM lobby_slots WHERE user_id = $1', [req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /lobby/my error:', err);
    res.status(500).json({ error: 'Ошибка удаления слота' });
  }
});

// POST /api/lobby/:id/join — join a slot, creates a room
router.post('/:id/join', authRequired, async (req, res) => {
  const slotId = parseInt(req.params.id, 10);
  const joinerId = req.user.id;

  try {
    const slotResult = await pool.query(
      `SELECT * FROM lobby_slots WHERE id = $1 AND status = 'open' AND expires_at > NOW()`,
      [slotId]
    );
    if (slotResult.rows.length === 0) {
      res.status(404).json({ error: 'Слот не найден или уже занят' });
      return;
    }
    const slot = slotResult.rows[0];

    if (slot.user_id === joinerId) {
      res.status(400).json({ error: 'Нельзя принять свою игру' });
      return;
    }

    const joinerRow = await pool.query(
      'SELECT username FROM users WHERE id = $1',
      [joinerId]
    );
    if (joinerRow.rows.length === 0) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }
    const joinerName = joinerRow.rows[0].username;

    // Creator is always player1, joiner is player2
    const roomResult = await pool.query(
      `INSERT INTO rooms
         (board_size, creator_player, state_json, tree_json, rated,
          user1_id, user2_id, player1_name, player2_name,
          time_control_base_ms, time_control_increment_ms,
          clock_p1_ms, clock_p2_ms)
       VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        slot.board_size, slot.state_json, slot.tree_json, slot.rated,
        slot.user_id, joinerId, slot.username, joinerName,
        slot.time_control_base_ms, slot.time_control_increment_ms,
        slot.time_control_base_ms, slot.time_control_base_ms,
      ]
    );
    const roomId = roomResult.rows[0].id;

    // Mark slot as joined so creator's poll can pick it up
    await pool.query(
      `UPDATE lobby_slots SET status = 'joined', room_id = $2 WHERE id = $1`,
      [slotId, roomId]
    );

    // Push notification to slot creator
    sendPushToUser(slot.user_id, {
      type: 'lobby_join',
      title: 'Zertz',
      body: `${joinerName} принял вашу игру в лобби!`,
    });

    res.json({ roomId });
  } catch (err) {
    console.error('POST /lobby/:id/join error:', err);
    res.status(500).json({ error: 'Ошибка присоединения к игре' });
  }
});

export default router;
