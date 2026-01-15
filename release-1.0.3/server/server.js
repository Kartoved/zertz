import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const port = process.env.PORT || 5050;

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'zertz',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));

async function ensureSchema() {
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '..', 'dist');

app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

ensureSchema()
  .then(() => {
    app.listen(port, () => {
      console.log(`ZERTZ API server running at http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
