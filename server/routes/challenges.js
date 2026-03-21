import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// Create a challenge (immediately creates a room)
router.post('/', authRequired, async (req, res) => {
  const { toUserId, boardSize = 37, rated = false, creatorPlayer = 1 } = req.body;
  const fromUserId = req.user.id;

  if (fromUserId === toUserId) {
    res.status(400).json({ error: 'Нельзя вызвать самого себя' });
    return;
  }

  try {
    // Check active outgoing challenges limit (max 3)
    const activeCount = await pool.query(
      "SELECT COUNT(*) FROM challenges WHERE from_user_id = $1 AND status = 'pending'",
      [fromUserId]
    );
    if (parseInt(activeCount.rows[0].count) >= 3) {
      res.status(400).json({ error: 'Максимум 3 активных вызова' });
      return;
    }

    // Create the room immediately
    const { createInitialState, createRootNode, serializeState, serializeTree } = await import('../gameHelpers.js').catch(() => null) || {};

    // Build initial state/tree JSON inline since we can't import game logic in server
    // The room will be populated with proper state when the challenge is accepted
    const stateJson = req.body.stateJson;
    const treeJson = req.body.treeJson;

    if (!stateJson || !treeJson) {
      res.status(400).json({ error: 'Missing state or tree' });
      return;
    }

    const userCol = creatorPlayer === 1 ? 'user1_id' : 'user2_id';
    const roomResult = await pool.query(
      `INSERT INTO rooms (board_size, creator_player, state_json, tree_json, rated, ${userCol})
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [boardSize, creatorPlayer, stateJson, treeJson, rated, fromUserId]
    );
    const roomId = roomResult.rows[0].id;

    // Set creator's name
    const userRow = await pool.query('SELECT username FROM users WHERE id = $1', [fromUserId]);
    const playerNameCol = creatorPlayer === 1 ? 'player1_name' : 'player2_name';
    await pool.query(`UPDATE rooms SET ${playerNameCol} = $2 WHERE id = $1`, [roomId, userRow.rows[0].username]);

    // Create the challenge
    const challengeResult = await pool.query(
      `INSERT INTO challenges (from_user_id, to_user_id, room_id, board_size, rated)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [fromUserId, toUserId, roomId, boardSize, rated]
    );

    res.json({
      id: challengeResult.rows[0].id,
      roomId,
      createdAt: challengeResult.rows[0].created_at.getTime(),
    });
  } catch (err) {
    console.error('Create challenge error:', err);
    res.status(500).json({ error: 'Ошибка создания вызова' });
  }
});

// Cancel a challenge (only sender can cancel)
router.delete('/:id', authRequired, async (req, res) => {
  const challengeId = parseInt(req.params.id, 10);
  try {
    const result = await pool.query(
      "UPDATE challenges SET status = 'cancelled' WHERE id = $1 AND from_user_id = $2 AND status = 'pending' RETURNING room_id",
      [challengeId, req.user.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Вызов не найден' });
      return;
    }
    // Delete the room too
    await pool.query('DELETE FROM rooms WHERE id = $1', [result.rows[0].room_id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Cancel challenge error:', err);
    res.status(500).json({ error: 'Ошибка отмены вызова' });
  }
});

// Accept a challenge (only receiver can accept)
router.put('/:id/accept', authRequired, async (req, res) => {
  const challengeId = parseInt(req.params.id, 10);
  try {
    const result = await pool.query(
      "SELECT * FROM challenges WHERE id = $1 AND to_user_id = $2 AND status = 'pending'",
      [challengeId, req.user.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Вызов не найден' });
      return;
    }

    const challenge = result.rows[0];

    // Get room to determine which player slot to fill
    const roomRow = await pool.query('SELECT creator_player FROM rooms WHERE id = $1', [challenge.room_id]);
    const joinerPlayer = roomRow.rows[0].creator_player === 1 ? 2 : 1;
    const userCol = joinerPlayer === 1 ? 'user1_id' : 'user2_id';
    const nameCol = joinerPlayer === 1 ? 'player1_name' : 'player2_name';

    // Get acceptor's username
    const userRow = await pool.query('SELECT username FROM users WHERE id = $1', [req.user.id]);

    // Update room with joiner info
    await pool.query(`UPDATE rooms SET ${userCol} = $2, ${nameCol} = $3 WHERE id = $1`, [challenge.room_id, req.user.id, userRow.rows[0].username]);

    // Mark challenge as accepted
    await pool.query("UPDATE challenges SET status = 'accepted' WHERE id = $1", [challengeId]);

    res.json({ roomId: challenge.room_id });
  } catch (err) {
    console.error('Accept challenge error:', err);
    res.status(500).json({ error: 'Ошибка принятия вызова' });
  }
});

// Decline a challenge (only receiver can decline)
router.put('/:id/decline', authRequired, async (req, res) => {
  const challengeId = parseInt(req.params.id, 10);
  try {
    const result = await pool.query(
      "UPDATE challenges SET status = 'declined' WHERE id = $1 AND to_user_id = $2 AND status = 'pending' RETURNING room_id",
      [challengeId, req.user.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Вызов не найден' });
      return;
    }
    await pool.query('DELETE FROM rooms WHERE id = $1', [result.rows[0].room_id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Decline challenge error:', err);
    res.status(500).json({ error: 'Ошибка отклонения вызова' });
  }
});

// Get my challenges (incoming + outgoing)
router.get('/', authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*,
        fu.username AS from_username, fu.rating AS from_rating, fu.country AS from_country,
        tu.username AS to_username, tu.rating AS to_rating, tu.country AS to_country
       FROM challenges c
       JOIN users fu ON fu.id = c.from_user_id
       JOIN users tu ON tu.id = c.to_user_id
       WHERE (c.from_user_id = $1 OR c.to_user_id = $1) AND c.status = 'pending'
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows.map(r => ({
      id: r.id,
      fromUserId: r.from_user_id,
      toUserId: r.to_user_id,
      fromUsername: r.from_username,
      fromRating: Math.round(r.from_rating),
      fromCountry: r.from_country,
      toUsername: r.to_username,
      toRating: Math.round(r.to_rating),
      toCountry: r.to_country,
      roomId: r.room_id,
      boardSize: r.board_size,
      rated: r.rated,
      status: r.status,
      createdAt: r.created_at.getTime(),
    })));
  } catch (err) {
    console.error('Get challenges error:', err);
    res.status(500).json({ error: 'Ошибка получения вызовов' });
  }
});

export default router;
