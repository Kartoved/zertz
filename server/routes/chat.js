import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
const PAGE_SIZE = 50;

// Get global chat messages.
//
// Query params (mutually exclusive):
//   ?after=<id>   — poll for new messages since <id>  (returns ASC, no hasMore)
//   ?before=<id>  — load-more-history before <id>     (returns ASC, includes hasMore)
//   (none)        — initial load: last PAGE_SIZE messages (includes hasMore)
router.get('/', async (req, res) => {
  const { after, before } = req.query;
  try {
    if (after) {
      // Incremental poll: return all messages after the cursor (no hasMore needed).
      const result = await pool.query(
        `SELECT id, user_id, username, message, created_at
           FROM global_chat_messages
          WHERE id > $1
          ORDER BY created_at ASC`,
        [after]
      );
      res.json({
        messages: result.rows.map(toDto),
        hasMore: false,
      });
      return;
    }

    if (before) {
      // Load-more: fetch PAGE_SIZE messages older than <before>.
      const result = await pool.query(
        `SELECT id, user_id, username, message, created_at
           FROM global_chat_messages
          WHERE id < $1
          ORDER BY id DESC
          LIMIT $2`,
        [before, PAGE_SIZE + 1]
      );
      const rows = result.rows.reverse();
      const hasMore = rows.length > PAGE_SIZE;
      res.json({
        messages: rows.slice(hasMore ? 1 : 0).map(toDto),
        hasMore,
      });
      return;
    }

    // Initial load: most recent PAGE_SIZE messages.
    const result = await pool.query(
      `SELECT id, user_id, username, message, created_at
         FROM global_chat_messages
        ORDER BY id DESC
        LIMIT $1`,
      [PAGE_SIZE + 1]
    );
    const rows = result.rows.reverse();
    const hasMore = rows.length > PAGE_SIZE;
    res.json({
      messages: rows.slice(hasMore ? 1 : 0).map(toDto),
      hasMore,
    });
  } catch (err) {
    console.error('GET /global-chat error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

function toDto(row) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    message: row.message,
    createdAt: row.created_at.getTime(),
  };
}

// Send global chat message (auth only)
router.post('/', authRequired, async (req, res) => {
  const { message } = req.body;
  const userId = req.user.id;

  if (!message || !String(message).trim()) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  try {
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

    res.json(toDto({ ...result.rows[0], user_id: userId, username, message: cleanMessage }));
  } catch (err) {
    console.error('POST /global-chat error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
