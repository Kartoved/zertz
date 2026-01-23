import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const port = process.env.PORT || 5050;

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT || 5432),
        database: process.env.PGDATABASE || 'zertz',
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
      }
);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

async function ensureSchema() {
  // Local games table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      player1_name TEXT NOT NULL,
      player2_name TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      move_count INTEGER NOT NULL,
      winner TEXT,
      win_type TEXT,
      board_size INTEGER NOT NULL,
      state_json TEXT NOT NULL,
      tree_json TEXT NOT NULL
    );
  `);

  // Online rooms table with sequential IDs
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      id SERIAL PRIMARY KEY,
      board_size INTEGER NOT NULL DEFAULT 37,
      current_player INTEGER NOT NULL DEFAULT 1,
      creator_player INTEGER NOT NULL DEFAULT 1,
      winner INTEGER,
      win_type TEXT,
      state_json TEXT NOT NULL,
      tree_json TEXT NOT NULL,
      player1_name TEXT NOT NULL DEFAULT 'Игрок 1',
      player2_name TEXT NOT NULL DEFAULT 'Игрок 2',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // Chat messages table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
      player_index INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // Create index for faster chat queries
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_chat_room_id ON chat_messages(room_id);
  `);
}

app.get('/api/health', async (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/games', async (_req, res) => {
  const result = await pool.query(
    `SELECT id, player1_name, player2_name, updated_at, move_count, winner, win_type, board_size
     FROM games
     ORDER BY updated_at DESC`
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
    }))
  );
});

app.get('/api/games/:id', async (req, res) => {
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

app.post('/api/games', async (req, res) => {
  const {
    id,
    playerNames,
    moveCount,
    winner,
    winType,
    boardSize,
    stateJson,
    treeJson,
  } = req.body;

  if (!id || !playerNames || !stateJson || !treeJson) {
    res.status(400).json({ error: 'Missing fields' });
    return;
  }

  await pool.query(
    `INSERT INTO games (id, player1_name, player2_name, move_count, winner, win_type, board_size, state_json, tree_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO UPDATE SET
       player1_name = EXCLUDED.player1_name,
       player2_name = EXCLUDED.player2_name,
       updated_at = NOW(),
       move_count = EXCLUDED.move_count,
       winner = EXCLUDED.winner,
       win_type = EXCLUDED.win_type,
       board_size = EXCLUDED.board_size,
       state_json = EXCLUDED.state_json,
       tree_json = EXCLUDED.tree_json
    `,
    [
      id,
      playerNames.player1,
      playerNames.player2,
      moveCount,
      winner,
      winType,
      boardSize,
      stateJson,
      treeJson,
    ]
  );

  res.json({ ok: true });
});

app.delete('/api/games/:id', async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM games WHERE id = $1', [id]);
  res.json({ ok: true });
});

// ==================== ROOMS API ====================

// Create a new room
app.post('/api/rooms', async (req, res) => {
  const { boardSize = 37, creatorPlayer = 1, stateJson, treeJson } = req.body;
  
  if (!stateJson || !treeJson) {
    res.status(400).json({ error: 'Missing state or tree' });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO rooms (board_size, creator_player, state_json, tree_json)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [boardSize, creatorPlayer, stateJson, treeJson]
    );
    
    res.json({ id: result.rows[0].id });
  } catch (err) {
    console.error('Error creating room:', err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Get room by ID
app.get('/api/rooms/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM rooms WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    
    const row = result.rows[0];
    res.json({
      id: row.id,
      boardSize: row.board_size,
      currentPlayer: row.current_player,
      creatorPlayer: row.creator_player || 1,
      winner: row.winner,
      winType: row.win_type,
      stateJson: row.state_json,
      treeJson: row.tree_json,
      playerNames: { player1: row.player1_name, player2: row.player2_name },
      createdAt: row.created_at.getTime(),
      updatedAt: row.updated_at.getTime(),
    });
  } catch (err) {
    console.error('Error getting room:', err);
    res.status(500).json({ error: 'Failed to get room' });
  }
});

// Update room state (after each move)
app.put('/api/rooms/:id/state', async (req, res) => {
  const { id } = req.params;
  const { stateJson, treeJson, currentPlayer, winner, winType } = req.body;
  
  await pool.query(
    `UPDATE rooms SET
       state_json = $2,
       tree_json = $3,
       current_player = $4,
       winner = $5,
       win_type = $6,
       updated_at = NOW()
     WHERE id = $1`,
    [id, stateJson, treeJson, currentPlayer, winner, winType]
  );
  
  res.json({ ok: true });
});

// Update player name
app.put('/api/rooms/:id/players/:index', async (req, res) => {
  const { id, index } = req.params;
  const { name } = req.body;
  const playerIndex = parseInt(index, 10);
  
  if (playerIndex !== 1 && playerIndex !== 2) {
    res.status(400).json({ error: 'Invalid player index' });
    return;
  }
  
  const column = playerIndex === 1 ? 'player1_name' : 'player2_name';
  await pool.query(
    `UPDATE rooms SET ${column} = $2, updated_at = NOW() WHERE id = $1`,
    [id, name]
  );
  
  res.json({ ok: true });
});

// Get chat messages
app.get('/api/rooms/:id/messages', async (req, res) => {
  const { id } = req.params;
  const { after } = req.query;
  
  let query = 'SELECT * FROM chat_messages WHERE room_id = $1';
  const params = [id];
  
  if (after) {
    query += ' AND id > $2';
    params.push(after);
  }
  
  query += ' ORDER BY created_at ASC';
  
  const result = await pool.query(query, params);
  res.json(result.rows.map(row => ({
    id: row.id,
    playerIndex: row.player_index,
    message: row.message,
    createdAt: row.created_at.getTime(),
  })));
});

// Send chat message
app.post('/api/rooms/:id/messages', async (req, res) => {
  const { id } = req.params;
  const { playerIndex, message } = req.body;
  
  if (!message || (playerIndex !== 1 && playerIndex !== 2)) {
    res.status(400).json({ error: 'Invalid message or player' });
    return;
  }
  
  const result = await pool.query(
    `INSERT INTO chat_messages (room_id, player_index, message)
     VALUES ($1, $2, $3)
     RETURNING id, created_at`,
    [id, playerIndex, message]
  );
  
  res.json({
    id: result.rows[0].id,
    playerIndex,
    message,
    createdAt: result.rows[0].created_at.getTime(),
  });
});

// Delete room
app.delete('/api/rooms/:id', async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM rooms WHERE id = $1', [id]);
  res.json({ ok: true });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '..', 'dist');

app.use(express.static(distPath));
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});


const startServer = async () => {
  try {
    await ensureSchema();
    console.log('Postgres connected.');
  } catch (err) {
    console.error('Postgres unavailable, running without API persistence.');
  }

  app.listen(port, () => {
    console.log(`ZERTZ server running at http://localhost:${port}`);
  });
};

startServer();
