import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// Get global chat messages
router.get('/', async (req, res) => {
  const { after } = req.query;

  let query = 'SELECT id, user_id, username, message, created_at FROM global_chat_messages';
  const params = [];

  if (after) {
    query += ' WHERE id > $1';
    params.push(after);
  }

  query += ' ORDER BY created_at ASC LIMIT 300';

  const result = await pool.query(query, params);
  res.json(result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    username: row.username,
    message: row.message,
    createdAt: row.created_at.getTime(),
  })));
});

// Send global chat message (auth only)
router.post('/', authRequired, async (req, res) => {
  const { message } = req.body;
  const userId = req.user.id;

  if (!message || !String(message).trim()) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  const userResult = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
  if (userResult.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const username = userResult.rows[0].username;
  const cleanMessage = String(message).trim().slice(0, 500);

  const result = await pool.query(
    `INSERT INTO global_chat_messages (user_id, username, message)
     VALUES ($1, $2, $3)
     RETURNING id, created_at`,
    [userId, username, cleanMessage]
  );

  res.json({
    id: result.rows[0].id,
    userId,
    username,
    message: cleanMessage,
    createdAt: result.rows[0].created_at.getTime(),
  });
});

export default router;
