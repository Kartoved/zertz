import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'zertz-dev-secret-change-me-in-production';

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

  // Users table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      quote TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '🌍',
      rating REAL NOT NULL DEFAULT 1500,
      rating_rd REAL NOT NULL DEFAULT 350,
      rating_vol REAL NOT NULL DEFAULT 0.06,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      best_streak INTEGER NOT NULL DEFAULT 0,
      current_streak INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // Add rated/user columns to rooms (safe to re-run)
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS rated BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS user1_id INTEGER REFERENCES users(id);
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS user2_id INTEGER REFERENCES users(id);
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `);
}

app.get('/api/health', async (_req, res) => {
  res.json({ ok: true });
});

// ==================== AUTH MIDDLEWARE ====================

function authOptional(req, _res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(header.slice(7), JWT_SECRET);
      req.user = decoded;
    } catch {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}

function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Требуется авторизация' });
    return;
  }
  try {
    const decoded = jwt.verify(header.slice(7), JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Недействительный токен' });
  }
}

// ==================== GLICKO-2 ====================

function glicko2Update(r, rd, vol, opponentR, opponentRd, score) {
  const TAU = 0.5;
  const PI2 = Math.PI * Math.PI;
  const SCALE = 173.7178;

  const mu = (r - 1500) / SCALE;
  const phi = rd / SCALE;
  const muJ = (opponentR - 1500) / SCALE;
  const phiJ = opponentRd / SCALE;

  const gPhiJ = 1 / Math.sqrt(1 + 3 * phiJ * phiJ / PI2);
  const E = 1 / (1 + Math.exp(-gPhiJ * (mu - muJ)));
  const v = 1 / (gPhiJ * gPhiJ * E * (1 - E));
  const delta = v * gPhiJ * (score - E);

  // Iterative algorithm to find new volatility
  const a = Math.log(vol * vol);
  const f = (x) => {
    const ex = Math.exp(x);
    const d2 = delta * delta;
    const p2 = phi * phi;
    const num1 = ex * (d2 - p2 - v - ex);
    const den1 = 2 * (p2 + v + ex) * (p2 + v + ex);
    return num1 / den1 - (x - a) / (TAU * TAU);
  };

  let A = a;
  let B;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }

  let fA = f(A);
  let fB = f(B);
  const EPSILON = 0.000001;

  while (Math.abs(B - A) > EPSILON) {
    const C = A + (A - B) * fA / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA = fA / 2;
    }
    B = C;
    fB = fC;
  }

  const newVol = Math.exp(B / 2);
  const phiStar = Math.sqrt(phi * phi + newVol * newVol);
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * gPhiJ * (score - E);

  return {
    rating: Math.round(newMu * SCALE + 1500),
    rd: Math.max(Math.round(newPhi * SCALE * 100) / 100, 30),
    vol: Math.round(newVol * 1000000) / 1000000,
  };
}

// ==================== AUTH API ====================

const SPECIAL_CHARS = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;

app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Укажите ник и пароль' });
    return;
  }

  const trimmedName = username.trim();
  if (trimmedName.length < 2 || trimmedName.length > 24) {
    res.status(400).json({ error: 'Ник должен быть от 2 до 24 символов' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Пароль должен быть не менее 8 символов' });
    return;
  }

  if (!SPECIAL_CHARS.test(password)) {
    res.status(400).json({ error: 'Пароль должен содержать хотя бы один спецсимвол' });
    return;
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [trimmedName]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Ник уже занят' });
      return;
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, quote, country, rating, rating_rd, wins, losses, best_streak, current_streak, created_at`,
      [trimmedName, hash]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        quote: user.quote,
        country: user.country,
        rating: user.rating,
        ratingRd: user.rating_rd,
        wins: user.wins,
        losses: user.losses,
        bestStreak: user.best_streak,
        currentStreak: user.current_streak,
        createdAt: user.created_at.getTime(),
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Укажите ник и пароль' });
    return;
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username.trim()]);
    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Неверный ник или пароль' });
      return;
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Неверный ник или пароль' });
      return;
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        quote: user.quote,
        country: user.country,
        rating: user.rating,
        ratingRd: user.rating_rd,
        wins: user.wins,
        losses: user.losses,
        bestStreak: user.best_streak,
        currentStreak: user.current_streak,
        createdAt: user.created_at.getTime(),
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Ошибка входа' });
  }
});

app.get('/api/auth/me', authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, quote, country, rating, rating_rd, wins, losses, best_streak, current_streak, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }
    const u = result.rows[0];
    res.json({
      id: u.id,
      username: u.username,
      quote: u.quote,
      country: u.country,
      rating: u.rating,
      ratingRd: u.rating_rd,
      wins: u.wins,
      losses: u.losses,
      bestStreak: u.best_streak,
      currentStreak: u.current_streak,
      createdAt: u.created_at.getTime(),
    });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Ошибка получения профиля' });
  }
});

app.put('/api/auth/profile', authRequired, async (req, res) => {
  const { quote, country, oldPassword, newPassword } = req.body;

  try {
    if (newPassword !== undefined) {
      if (!oldPassword) {
        res.status(400).json({ error: 'Укажите текущий пароль' });
        return;
      }
      if (newPassword.length < 8) {
        res.status(400).json({ error: 'Новый пароль должен быть не менее 8 символов' });
        return;
      }
      if (!SPECIAL_CHARS.test(newPassword)) {
        res.status(400).json({ error: 'Новый пароль должен содержать хотя бы один спецсимвол' });
        return;
      }
      const userRow = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
      const valid = await bcrypt.compare(oldPassword, userRow.rows[0].password_hash);
      if (!valid) {
        res.status(401).json({ error: 'Неверный текущий пароль' });
        return;
      }
      const hash = await bcrypt.hash(newPassword, 12);
      await pool.query('UPDATE users SET password_hash = $2 WHERE id = $1', [req.user.id, hash]);
    }

    if (quote !== undefined) {
      await pool.query('UPDATE users SET quote = $2 WHERE id = $1', [req.user.id, quote.slice(0, 200)]);
    }
    if (country !== undefined) {
      await pool.query('UPDATE users SET country = $2 WHERE id = $1', [req.user.id, country.slice(0, 10)]);
    }

    const result = await pool.query(
      'SELECT id, username, quote, country, rating, rating_rd, wins, losses, best_streak, current_streak, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    const u = result.rows[0];
    res.json({
      id: u.id,
      username: u.username,
      quote: u.quote,
      country: u.country,
      rating: u.rating,
      ratingRd: u.rating_rd,
      wins: u.wins,
      losses: u.losses,
      bestStreak: u.best_streak,
      currentStreak: u.current_streak,
      createdAt: u.created_at.getTime(),
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Ошибка обновления профиля' });
  }
});

// ==================== PLAYERS API ====================

app.get('/api/players', async (req, res) => {
  const allowedSort = ['rating', 'wins', 'losses', 'username', 'created_at'];
  let sort = req.query.sort || 'rating';
  if (!allowedSort.includes(sort)) sort = 'rating';
  const order = req.query.order === 'asc' ? 'ASC' : 'DESC';

  try {
    const result = await pool.query(
      `SELECT id, username, country, rating, wins, losses, best_streak, created_at
       FROM users ORDER BY ${sort} ${order}, id ASC`
    );
    res.json(result.rows.map(u => ({
      id: u.id,
      username: u.username,
      country: u.country,
      rating: Math.round(u.rating),
      wins: u.wins,
      losses: u.losses,
      games: u.wins + u.losses,
      winrate: (u.wins + u.losses) > 0 ? Math.round(u.wins / (u.wins + u.losses) * 100) : 0,
      bestStreak: u.best_streak,
      createdAt: u.created_at.getTime(),
    })));
  } catch (err) {
    console.error('Players list error:', err);
    res.status(500).json({ error: 'Ошибка получения списка игроков' });
  }
});

// ==================== GAMES API ====================

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
app.post('/api/rooms', authOptional, async (req, res) => {
  const { boardSize = 37, creatorPlayer = 1, stateJson, treeJson, rated = false } = req.body;
  
  if (!stateJson || !treeJson) {
    res.status(400).json({ error: 'Missing state or tree' });
    return;
  }

  const userId = req.user ? req.user.id : null;
  const userCol = creatorPlayer === 1 ? 'user1_id' : 'user2_id';

  try {
    const result = await pool.query(
      `INSERT INTO rooms (board_size, creator_player, state_json, tree_json, rated, ${userCol})
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [boardSize, creatorPlayer, stateJson, treeJson, rated && !!userId, userId]
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
      rated: row.rated || false,
      user1Id: row.user1_id || null,
      user2Id: row.user2_id || null,
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

  // Glicko-2 rating update for rated games when winner is determined
  if (winner) {
    try {
      const roomRow = await pool.query('SELECT rated, user1_id, user2_id FROM rooms WHERE id = $1', [id]);
      const room = roomRow.rows[0];
      if (room && room.rated && room.user1_id && room.user2_id) {
        const u1Row = await pool.query('SELECT id, rating, rating_rd, rating_vol, wins, losses, current_streak, best_streak FROM users WHERE id = $1', [room.user1_id]);
        const u2Row = await pool.query('SELECT id, rating, rating_rd, rating_vol, wins, losses, current_streak, best_streak FROM users WHERE id = $1', [room.user2_id]);
        const u1 = u1Row.rows[0];
        const u2 = u2Row.rows[0];

        if (u1 && u2) {
          const score1 = winner === 1 ? 1 : 0;
          const score2 = winner === 2 ? 1 : 0;

          const new1 = glicko2Update(u1.rating, u1.rating_rd, u1.rating_vol, u2.rating, u2.rating_rd, score1);
          const new2 = glicko2Update(u2.rating, u2.rating_rd, u2.rating_vol, u1.rating, u1.rating_rd, score2);

          // Update player 1
          const streak1 = winner === 1 ? u1.current_streak + 1 : 0;
          const best1 = Math.max(u1.best_streak, streak1);
          await pool.query(
            `UPDATE users SET rating=$2, rating_rd=$3, rating_vol=$4, wins=wins+$5, losses=losses+$6, current_streak=$7, best_streak=$8 WHERE id=$1`,
            [u1.id, new1.rating, new1.rd, new1.vol, score1, score2, streak1, best1]
          );

          // Update player 2
          const streak2 = winner === 2 ? u2.current_streak + 1 : 0;
          const best2 = Math.max(u2.best_streak, streak2);
          await pool.query(
            `UPDATE users SET rating=$2, rating_rd=$3, rating_vol=$4, wins=wins+$5, losses=losses+$6, current_streak=$7, best_streak=$8 WHERE id=$1`,
            [u2.id, new2.rating, new2.rd, new2.vol, score2, score1, streak2, best2]
          );
        }
      }
    } catch (err) {
      console.error('Glicko update error:', err);
    }
  }
  
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

// Join room as authenticated user (assign user_id to correct slot)
app.put('/api/rooms/:id/join', authOptional, async (req, res) => {
  const { id } = req.params;
  const { playerIndex } = req.body;
  const userId = req.user ? req.user.id : null;

  if (!userId || (playerIndex !== 1 && playerIndex !== 2)) {
    res.status(400).json({ error: 'Invalid join request' });
    return;
  }

  const col = playerIndex === 1 ? 'user1_id' : 'user2_id';
  await pool.query(`UPDATE rooms SET ${col} = $2 WHERE id = $1`, [id, userId]);
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
