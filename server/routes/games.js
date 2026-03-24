import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired, optionalAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', authRequired, async (req, res) => {
  const userId = req.user.id;
  const username = req.user.username;
  const result = await pool.query(
    `SELECT id, player1_name, player2_name, updated_at, move_count, winner, win_type, board_size, is_online
     FROM games
     WHERE user_id = $1 OR (is_online = true AND (player1_name = $2 OR player2_name = $2)) OR (is_online = false AND (player1_name = $2 OR player2_name = $2))
     ORDER BY updated_at DESC`, [userId, username]
  );
  res.json(
    result.rows.map(row => ({
      id: row.id,
      playerNames: { player1: row.player1_name, player2: row.player2_name },
      updatedAt: row.updated_at.getTime(),
      moveCount: row.move_count,
      winner: row.winner,
      winType: row.win_type,
      boardSize: row.board_size,
      isOnline: row.is_online,
    }))
  );
});

// Public game archive — returns recent online games, optionally filtered by username
router.get('/public', async (req, res) => {
  const { username } = req.query;
  const params = [];
  let whereClause = 'WHERE is_online = true';

  if (username) {
    whereClause += ' AND (player1_name = $1 OR player2_name = $1)';
    params.push(username);
  }

  const result = await pool.query(
    `SELECT id, player1_name, player2_name, updated_at, move_count, winner, win_type, board_size
     FROM games
     ${whereClause}
     ORDER BY updated_at DESC
     LIMIT 100`,
    params
  );

  res.json(result.rows.map(row => ({
    id: row.id,
    playerNames: { player1: row.player1_name, player2: row.player2_name },
    updatedAt: row.updated_at.getTime(),
    moveCount: row.move_count,
    winner: row.winner,
    winType: row.win_type,
    boardSize: row.board_size,
    isOnline: true,
  })));
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const result = await pool.query('SELECT * FROM games WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const row = result.rows[0];
  res.json({
    id: row.id,
    playerNames: { player1: row.player1_name, player2: row.player2_name },
    createdAt: row.created_at.getTime(),
    updatedAt: row.updated_at.getTime(),
    moveCount: row.move_count,
    winner: row.winner,
    winType: row.win_type,
    boardSize: row.board_size,
    stateJson: row.state_json,
    treeJson: row.tree_json,
  });
});

router.post('/', optionalAuth, async (req, res) => {
  const userId = req.user ? req.user.id : null;
  const {
    id,
    playerNames,
    moveCount,
    winner,
    winType,
    isOnline,
    boardSize,
    stateJson,
    treeJson,
  } = req.body;

  if (!id || !playerNames || !stateJson || !treeJson) {
    res.status(400).json({ error: 'Missing fields' });
    return;
  }

  await pool.query(
    `INSERT INTO games (id, user_id, player1_name, player2_name, move_count, winner, win_type, is_online, board_size, state_json, tree_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       player1_name = EXCLUDED.player1_name,
       player2_name = EXCLUDED.player2_name,
       updated_at = NOW(),
       move_count = EXCLUDED.move_count,
       winner = EXCLUDED.winner,
       win_type = EXCLUDED.win_type,
       is_online = EXCLUDED.is_online,
       board_size = EXCLUDED.board_size,
       state_json = EXCLUDED.state_json,
       tree_json = EXCLUDED.tree_json
    `,
    [
      id,
      userId,
      playerNames.player1,
      playerNames.player2,
      moveCount,
      winner,
      winType,
      !!isOnline,
      boardSize,
      stateJson,
      treeJson,
    ]
  );

  res.json({ ok: true });
});

router.delete('/:id', optionalAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user ? req.user.id : null;
  if (userId) {
     await pool.query('DELETE FROM games WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)', [id, userId]);
  } else {
     await pool.query('DELETE FROM games WHERE id = $1 AND user_id IS NULL', [id]);
  }
  res.json({ ok: true });
});

export default router;
