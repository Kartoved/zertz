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
      is_online BOOLEAN NOT NULL DEFAULT false,
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

  // Global chat messages table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS global_chat_messages (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      username TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_global_chat_id ON global_chat_messages(id);
  `);

  // Users table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      quote TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '🌍',
      contact_link TEXT NOT NULL DEFAULT '',
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
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS rating1_before REAL;
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS rating2_before REAL;
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS rating1_after REAL;
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS rating2_after REAL;
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS time_control_base_ms BIGINT;
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS time_control_increment_ms BIGINT;
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS clock_p1_ms BIGINT;
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS clock_p2_ms BIGINT;
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS clock_running_since TIMESTAMP;
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS time_forfeit_player INTEGER;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS contact_link TEXT NOT NULL DEFAULT '';
      ALTER TABLE games ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT false;
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `);

  // Follows table (one-way subscriptions)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS follows (
      follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (follower_id, following_id)
    );
  `);

  // Challenges table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS challenges (
      id SERIAL PRIMARY KEY,
      from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
      board_size INTEGER NOT NULL DEFAULT 37,
      rated BOOLEAN NOT NULL DEFAULT false,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_challenges_to ON challenges(to_user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_challenges_from ON challenges(from_user_id);`);
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
      `INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, quote, country, contact_link, rating, rating_rd, wins, losses, best_streak, current_streak, created_at`,
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
        contactLink: user.contact_link,
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
        contactLink: user.contact_link,
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
      'SELECT id, username, quote, country, contact_link, rating, rating_rd, wins, losses, best_streak, current_streak, created_at FROM users WHERE id = $1',
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
      contactLink: u.contact_link,
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
  const { quote, country, contactLink, oldPassword, newPassword } = req.body;

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
    if (contactLink !== undefined) {
      await pool.query('UPDATE users SET contact_link = $2 WHERE id = $1', [req.user.id, String(contactLink).slice(0, 300)]);
    }

    const result = await pool.query(
      'SELECT id, username, quote, country, contact_link, rating, rating_rd, wins, losses, best_streak, current_streak, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    const u = result.rows[0];
    res.json({
      id: u.id,
      username: u.username,
      quote: u.quote,
      country: u.country,
      contactLink: u.contact_link,
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
  const sortMap = {
    rating: 'rating',
    wins: 'wins',
    losses: 'losses',
    username: 'username',
    created_at: 'created_at',
    games: '(wins + losses)',
    winrate: 'CASE WHEN (wins + losses) > 0 THEN wins::float / (wins + losses) ELSE 0 END',
  };
  let sort = req.query.sort || 'rating';
  if (!Object.prototype.hasOwnProperty.call(sortMap, sort)) sort = 'rating';
  const order = req.query.order === 'asc' ? 'ASC' : 'DESC';
  const sortExpr = sortMap[sort];

  try {
    const result = await pool.query(
      `SELECT id, username, country, rating, wins, losses, best_streak, created_at
       FROM users ORDER BY ${sortExpr} ${order}, id ASC`
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

// ==================== FOLLOWS API ====================

app.post('/api/follows/:userId', authRequired, async (req, res) => {
  const targetId = parseInt(req.params.userId, 10);
  if (targetId === req.user.id) {
    res.status(400).json({ error: 'Нельзя подписаться на себя' });
    return;
  }
  try {
    await pool.query(
      'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.id, targetId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Follow error:', err);
    res.status(500).json({ error: 'Ошибка подписки' });
  }
});

app.delete('/api/follows/:userId', authRequired, async (req, res) => {
  const targetId = parseInt(req.params.userId, 10);
  try {
    await pool.query('DELETE FROM follows WHERE follower_id = $1 AND following_id = $2', [req.user.id, targetId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Unfollow error:', err);
    res.status(500).json({ error: 'Ошибка отписки' });
  }
});

app.get('/api/follows', authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.country, u.rating, u.wins, u.losses, u.best_streak, u.created_at
       FROM follows f JOIN users u ON u.id = f.following_id
       WHERE f.follower_id = $1
       ORDER BY u.rating DESC`,
      [req.user.id]
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
    console.error('Get follows error:', err);
    res.status(500).json({ error: 'Ошибка получения подписок' });
  }
});

// Get list of user IDs the current user follows (for quick lookup)
app.get('/api/follows/ids', authRequired, async (req, res) => {
  try {
    const result = await pool.query('SELECT following_id FROM follows WHERE follower_id = $1', [req.user.id]);
    res.json(result.rows.map(r => r.following_id));
  } catch (err) {
    console.error('Get follow ids error:', err);
    res.status(500).json({ error: 'Ошибка' });
  }
});

// ==================== CHALLENGES API ====================

// Create a challenge (immediately creates a room)
app.post('/api/challenges', authRequired, async (req, res) => {
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
    const { createInitialState, createRootNode, serializeState, serializeTree } = await import('./gameHelpers.js').catch(() => null) || {};
    
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
app.delete('/api/challenges/:id', authRequired, async (req, res) => {
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
app.put('/api/challenges/:id/accept', authRequired, async (req, res) => {
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
app.put('/api/challenges/:id/decline', authRequired, async (req, res) => {
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
app.get('/api/challenges', authRequired, async (req, res) => {
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

// Get player profile by ID
app.get('/api/players/:id', authOptional, async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  try {
    const result = await pool.query(
      'SELECT id, username, quote, country, contact_link, rating, rating_rd, wins, losses, best_streak, current_streak, created_at FROM users WHERE id = $1',
      [userId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Игрок не найден' });
      return;
    }
    const u = result.rows[0];
    const data = {
      id: u.id,
      username: u.username,
      quote: u.quote,
      country: u.country,
      contactLink: u.contact_link,
      rating: Math.round(u.rating),
      ratingRd: u.rating_rd,
      wins: u.wins,
      losses: u.losses,
      games: u.wins + u.losses,
      winrate: (u.wins + u.losses) > 0 ? Math.round(u.wins / (u.wins + u.losses) * 100) : 0,
      bestStreak: u.best_streak,
      currentStreak: u.current_streak,
      createdAt: u.created_at.getTime(),
      isFollowing: false,
    };

    // Check if current user follows this player
    if (req.user) {
      const followCheck = await pool.query(
        'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2',
        [req.user.id, userId]
      );
      data.isFollowing = followCheck.rows.length > 0;
    }

    res.json(data);
  } catch (err) {
    console.error('Get player error:', err);
    res.status(500).json({ error: 'Ошибка получения профиля игрока' });
  }
});

// ==================== GAMES API ====================

app.get('/api/games', async (_req, res) => {
  const result = await pool.query(
    `SELECT id, player1_name, player2_name, updated_at, move_count, winner, win_type, board_size, is_online
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
      isOnline: row.is_online,
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
    `INSERT INTO games (id, player1_name, player2_name, move_count, winner, win_type, is_online, board_size, state_json, tree_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (id) DO UPDATE SET
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

app.delete('/api/games/:id', async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM games WHERE id = $1', [id]);
  res.json({ ok: true });
});

// ==================== MATCHMAKING ====================

// In-memory matchmaking queue
// { userId: { boardSize, timeControl, rating, joinedAt, res? } }
const matchQueue = {};
// Store results for polling clients: { userId: roomId }
const matchedRooms = {};

app.post('/api/matchmake/join', authRequired, async (req, res) => {
  const { boardSize, timeControl, stateJson, treeJson } = req.body;
  const userId = req.user.id;

  if (!boardSize || !timeControl) {
    res.status(400).json({ error: 'Missing parameters' });
    return;
  }

  // Get user rating
  const uResult = await pool.query('SELECT rating FROM users WHERE id = $1', [userId]);
  if (uResult.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const rating = uResult.rows[0].rating;
  const joinedAt = Date.now();

  // Look for match
  let matchFound = null;
  for (const [otherIdStr, p] of Object.entries(matchQueue)) {
    const otherId = Number(otherIdStr);
    if (otherId === userId) continue;
    if (p.boardSize !== boardSize || p.timeControl !== timeControl) continue;

    const waitTime = Math.max(0, joinedAt - p.joinedAt);
    // Expand search by 50 rating points every second, up to 1000 max difference
    const acceptableDiff = 200 + Math.min(1000, Math.floor(waitTime / 1000) * 50);

    if (Math.abs(rating - p.rating) <= acceptableDiff) {
      matchFound = otherId;
      break;
    }
  }

  if (matchFound) {
    // We found a match! Create room.
    const otherPlayer = matchQueue[matchFound];
    delete matchQueue[matchFound];
    delete matchQueue[userId];

    const baseMap = {
      'blitz': 5 * 60 * 1000,
      'rapid': 15 * 60 * 1000,
      'long': 30 * 60 * 1000,
      'correspondence': null
    };
    const incMap = {
      'blitz': 5 * 1000,
      'rapid': 0,
      'long': 0,
      'correspondence': null
    };

    const cBase = baseMap[timeControl];
    const cInc = incMap[timeControl];
    const isTimed = cBase !== null && cInc !== null;
    
    try {
      const roomRes = await pool.query(
        `INSERT INTO rooms (
           board_size,
           creator_player,
           state_json,
           tree_json,
           rated,
           user1_id,
           user2_id,
           time_control_base_ms,
           time_control_increment_ms,
           clock_p1_ms,
           clock_p2_ms,
           clock_running_since
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id`,
        [
          boardSize,
          1, // Player 1
          otherPlayer.stateJson,
          otherPlayer.treeJson,
          true, // Rated by default for matchmaking
          matchFound, // Player 1 is whoever was waiting
          userId, // Player 2 is the new joiner
          cBase,
          cInc,
          cBase,
          cBase,
          null
        ]
      );
      const roomId = roomRes.rows[0].id;

      // Store in results for both players
      matchedRooms[userId] = roomId;
      matchedRooms[matchFound] = roomId;

      res.json({ status: 'matched', roomId });
      return;
    } catch (e) {
      console.error("Matchmaking room creation err:", e);
      res.status(500).json({ error: 'Failed to create matched room' });
      return;
    }
  }

// Nobody found, add to queue
matchQueue[userId] = { boardSize, timeControl, rating, joinedAt, stateJson, treeJson };
res.json({ status: 'searching' });
});

app.get('/api/matchmake/status', authRequired, (req, res) => {
  const userId = req.user.id;
  
  if (matchedRooms[userId]) {
    const roomId = matchedRooms[userId];
    delete matchedRooms[userId];
    res.json({ status: 'matched', roomId });
    return;
  }

  if (matchQueue[userId]) {
    res.json({ status: 'searching' });
    return;
  }

  res.json({ status: 'none' });
});

app.delete('/api/matchmake/leave', authRequired, (req, res) => {
  const userId = req.user.id;
  delete matchQueue[userId];
  delete matchedRooms[userId];
  res.json({ status: 'left' });
});


// ==================== ROOMS API ====================

// Create a new room
app.post('/api/rooms', authOptional, async (req, res) => {
  const {
    boardSize = 37,
    creatorPlayer = 1,
    stateJson,
    treeJson,
    rated = false,
    timeControlBaseMs = null,
    timeControlIncrementMs = null,
  } = req.body;
  
  if (!stateJson || !treeJson) {
    res.status(400).json({ error: 'Missing state or tree' });
    return;
  }

  const userId = req.user ? req.user.id : null;
  const userCol = creatorPlayer === 1 ? 'user1_id' : 'user2_id';
  const isTimed = Number.isFinite(timeControlBaseMs) && Number.isFinite(timeControlIncrementMs);

  if (isTimed && !userId) {
    res.status(401).json({ error: 'Timed invite rooms require authentication' });
    return;
  }

  if (isTimed && (timeControlBaseMs <= 0 || timeControlIncrementMs < 0)) {
    res.status(400).json({ error: 'Invalid time control values' });
    return;
  }

  try {
    const clockBase = isTimed ? Number(timeControlBaseMs) : null;
    const clockInc = isTimed ? Number(timeControlIncrementMs) : null;
    const now = null;

    const result = await pool.query(
      `INSERT INTO rooms (
         board_size,
         creator_player,
         state_json,
         tree_json,
         rated,
         ${userCol},
         time_control_base_ms,
         time_control_increment_ms,
         clock_p1_ms,
         clock_p2_ms,
         clock_running_since
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        boardSize,
        creatorPlayer,
        stateJson,
        treeJson,
        rated && !!userId,
        userId,
        clockBase,
        clockInc,
        clockBase,
        clockBase,
        now,
      ]
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
    
    let row = result.rows[0];

    const canTimeoutByRead =
      row.winner == null &&
      row.time_control_base_ms != null &&
      row.time_control_increment_ms != null &&
      row.clock_running_since != null;

    if (canTimeoutByRead) {
      const nowMs = Date.now();
      const startedMs = new Date(row.clock_running_since).getTime();
      const elapsedMs = Math.max(0, nowMs - startedMs);
      const baseMs = Number(row.time_control_base_ms);
      const p1Ms = row.clock_p1_ms == null ? baseMs : Number(row.clock_p1_ms);
      const p2Ms = row.clock_p2_ms == null ? baseMs : Number(row.clock_p2_ms);
      const movingPlayer = row.current_player === 1 ? 1 : 2;
      const remaining = movingPlayer === 1 ? p1Ms - elapsedMs : p2Ms - elapsedMs;

      if (remaining <= 0) {
        const winner = movingPlayer === 1 ? 2 : 1;
        const timeoutResult = await pool.query(
          `UPDATE rooms
             SET winner = $2,
                 win_type = 'time',
                 current_player = $3,
                 clock_p1_ms = $4,
                 clock_p2_ms = $5,
                 clock_running_since = NULL,
                 updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [
            id,
            winner,
            winner,
            movingPlayer === 1 ? 0 : p1Ms,
            movingPlayer === 2 ? 0 : p2Ms,
          ]
        );
        if (timeoutResult.rows.length > 0) {
          row = timeoutResult.rows[0];
        }
      }
    }

    // Fetch user ratings if users are associated
    let user1Rating = null;
    let user2Rating = null;
    if (row.user1_id) {
      const u = await pool.query('SELECT rating FROM users WHERE id = $1', [row.user1_id]);
      if (u.rows.length > 0) user1Rating = Math.round(u.rows[0].rating);
    }
    if (row.user2_id) {
      const u = await pool.query('SELECT rating FROM users WHERE id = $1', [row.user2_id]);
      if (u.rows.length > 0) user2Rating = Math.round(u.rows[0].rating);
    }

    const ratingDelta = (row.rating1_before != null && row.rating1_after != null) ? {
      player1: { before: Math.round(row.rating1_before), after: Math.round(row.rating1_after), delta: Math.round(row.rating1_after) - Math.round(row.rating1_before) },
      player2: { before: Math.round(row.rating2_before), after: Math.round(row.rating2_after), delta: Math.round(row.rating2_after) - Math.round(row.rating2_before) },
    } : null;

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
      user1Rating,
      user2Rating,
      ratingDelta,
      timeControlBaseMs: row.time_control_base_ms,
      timeControlIncrementMs: row.time_control_increment_ms,
      clockP1Ms: row.clock_p1_ms,
      clockP2Ms: row.clock_p2_ms,
      clockRunningSince: row.clock_running_since ? row.clock_running_since.getTime() : null,
    });
  } catch (err) {
    console.error('Error getting room:', err);
    res.status(500).json({ error: 'Failed to get room' });
  }
});

// Update room state (after each move)
app.put('/api/rooms/:id/state', authOptional, async (req, res) => {
  const { id } = req.params;
  const { stateJson, treeJson, currentPlayer, winner, winType, playerIndex } = req.body;

  const roomCheck = await pool.query(
    `SELECT
      current_player,
      winner,
      user1_id,
      user2_id,
      time_control_base_ms,
      time_control_increment_ms,
      clock_p1_ms,
      clock_p2_ms,
      clock_running_since
     FROM rooms
     WHERE id = $1`,
    [id]
  );

  if (roomCheck.rows.length === 0) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  const room = roomCheck.rows[0];

  if (room.winner) {
    res.status(400).json({ error: 'Игра уже завершена' });
    return;
  }

  // Turn enforcement: validate the submitting player matches the room's current_player
  if (playerIndex) {
    try {
      const authUserId = req.user ? req.user.id : null;
      const seatUserId = playerIndex === 1 ? room.user1_id : room.user2_id;

      if (!authUserId || !seatUserId || Number(authUserId) !== Number(seatUserId)) {
        res.status(403).json({ error: 'Нельзя ходить за другого игрока' });
        return;
      }
      if (room.current_player !== playerIndex) {
        res.status(403).json({ error: 'Не ваш ход' });
        return;
      }
    } catch (err) {
      console.error('Turn check error:', err);
    }
  }

  let nextWinner = winner;
  let nextWinType = winType;
  let nextCurrentPlayer = currentPlayer;
  let nextClockP1 = room.clock_p1_ms;
  let nextClockP2 = room.clock_p2_ms;
  let nextClockRunningSince = room.clock_running_since ? new Date() : null;

  const isTimedGame =
    room.time_control_base_ms != null &&
    room.time_control_increment_ms != null &&
    room.clock_running_since != null;

  if (isTimedGame) {
    const nowMs = Date.now();
    const startedMs = new Date(room.clock_running_since).getTime();
    const elapsedMs = Math.max(0, nowMs - startedMs);
    const movingPlayer = room.current_player === 1 ? 1 : 2;
    const baseMs = Number(room.time_control_base_ms);
    const incrementMs = Number(room.time_control_increment_ms);
    const p1Before = room.clock_p1_ms == null ? baseMs : Number(room.clock_p1_ms);
    const p2Before = room.clock_p2_ms == null ? baseMs : Number(room.clock_p2_ms);

    const didTurnPass = room.current_player !== nextCurrentPlayer;

    if (movingPlayer === 1) {
      const afterSpent = p1Before - elapsedMs;
      if (afterSpent <= 0) {
        nextClockP1 = 0;
        nextClockP2 = p2Before;
        nextWinner = 2;
        nextWinType = 'time';
        nextCurrentPlayer = 2;
        nextClockRunningSince = null;
      } else {
        nextClockP1 = afterSpent + (didTurnPass ? incrementMs : 0);
        nextClockP2 = p2Before;
      }
    } else {
      const afterSpent = p2Before - elapsedMs;
      if (afterSpent <= 0) {
        nextClockP1 = p1Before;
        nextClockP2 = 0;
        nextWinner = 1;
        nextWinType = 'time';
        nextCurrentPlayer = 1;
        nextClockRunningSince = null;
      } else {
        nextClockP1 = p1Before;
        nextClockP2 = afterSpent + (didTurnPass ? incrementMs : 0);
      }
    }

    if (!nextWinner) {
      nextClockRunningSince = new Date();
    }
  }

  if (nextWinner) {
    nextClockRunningSince = null;
  }
  
  await pool.query(
    `UPDATE rooms SET
       state_json = $2,
       tree_json = $3,
       current_player = $4,
       winner = $5,
       win_type = $6,
       clock_p1_ms = $7,
       clock_p2_ms = $8,
       clock_running_since = $9,
       updated_at = NOW()
     WHERE id = $1`,
    [
      id,
      stateJson,
      treeJson,
      nextCurrentPlayer,
      nextWinner,
      nextWinType,
      nextClockP1,
      nextClockP2,
      nextClockRunningSince,
    ]
  );

  let ratingDelta = null;

  // Glicko-2 rating update for rated games when winner is determined
  if (nextWinner) {
    try {
      const roomRow = await pool.query('SELECT rated, user1_id, user2_id FROM rooms WHERE id = $1', [id]);
      const room = roomRow.rows[0];
      if (room && room.rated && room.user1_id && room.user2_id) {
        const u1Row = await pool.query('SELECT id, rating, rating_rd, rating_vol, wins, losses, current_streak, best_streak FROM users WHERE id = $1', [room.user1_id]);
        const u2Row = await pool.query('SELECT id, rating, rating_rd, rating_vol, wins, losses, current_streak, best_streak FROM users WHERE id = $1', [room.user2_id]);
        const u1 = u1Row.rows[0];
        const u2 = u2Row.rows[0];

        if (u1 && u2) {
          const score1 = nextWinner === 1 ? 1 : 0;
          const score2 = nextWinner === 2 ? 1 : 0;

          const new1 = glicko2Update(u1.rating, u1.rating_rd, u1.rating_vol, u2.rating, u2.rating_rd, score1);
          const new2 = glicko2Update(u2.rating, u2.rating_rd, u2.rating_vol, u1.rating, u1.rating_rd, score2);

          // Store before/after ratings in room
          await pool.query(
            `UPDATE rooms SET rating1_before=$2, rating2_before=$3, rating1_after=$4, rating2_after=$5 WHERE id=$1`,
            [id, Math.round(u1.rating), Math.round(u2.rating), new1.rating, new2.rating]
          );

          // Update player 1
          const streak1 = nextWinner === 1 ? u1.current_streak + 1 : 0;
          const best1 = Math.max(u1.best_streak, streak1);
          await pool.query(
            `UPDATE users SET rating=$2, rating_rd=$3, rating_vol=$4, wins=wins+$5, losses=losses+$6, current_streak=$7, best_streak=$8 WHERE id=$1`,
            [u1.id, new1.rating, new1.rd, new1.vol, score1, score2, streak1, best1]
          );

          // Update player 2
          const streak2 = nextWinner === 2 ? u2.current_streak + 1 : 0;
          const best2 = Math.max(u2.best_streak, streak2);
          await pool.query(
            `UPDATE users SET rating=$2, rating_rd=$3, rating_vol=$4, wins=wins+$5, losses=losses+$6, current_streak=$7, best_streak=$8 WHERE id=$1`,
            [u2.id, new2.rating, new2.rd, new2.vol, score2, score1, streak2, best2]
          );

          ratingDelta = {
            player1: { before: Math.round(u1.rating), after: new1.rating, delta: new1.rating - Math.round(u1.rating) },
            player2: { before: Math.round(u2.rating), after: new2.rating, delta: new2.rating - Math.round(u2.rating) },
          };
        }
      }
    } catch (err) {
      console.error('Glicko update error:', err);
    }
  }
  
  res.json({ ok: true, ratingDelta });
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

  const roomResult = await pool.query('SELECT user1_id, user2_id FROM rooms WHERE id = $1', [id]);
  if (roomResult.rows.length === 0) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  const room = roomResult.rows[0];
  const targetSeatUserId = playerIndex === 1 ? room.user1_id : room.user2_id;
  const otherSeatUserId = playerIndex === 1 ? room.user2_id : room.user1_id;

  if (targetSeatUserId && Number(targetSeatUserId) !== Number(userId)) {
    res.status(409).json({ error: 'Это место уже занято' });
    return;
  }
  if (otherSeatUserId && Number(otherSeatUserId) === Number(userId)) {
    res.status(409).json({ error: 'Вы уже заняли другое место в этой комнате' });
    return;
  }

  const col = playerIndex === 1 ? 'user1_id' : 'user2_id';
  await pool.query(`UPDATE rooms SET ${col} = $2 WHERE id = $1`, [id, userId]);

  await pool.query(`
    UPDATE rooms
    SET clock_running_since = NOW()
    WHERE id = $1
      AND time_control_base_ms IS NOT NULL
      AND clock_running_since IS NULL
      AND user1_id IS NOT NULL
      AND user2_id IS NOT NULL
      AND winner IS NULL
  `, [id]);

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

// Get global chat messages
app.get('/api/global-chat', async (req, res) => {
  const { after } = req.query;

  let query = 'SELECT id, username, message, created_at FROM global_chat_messages';
  const params = [];

  if (after) {
    query += ' WHERE id > $1';
    params.push(after);
  }

  query += ' ORDER BY created_at ASC LIMIT 300';

  const result = await pool.query(query, params);
  res.json(result.rows.map((row) => ({
    id: row.id,
    username: row.username,
    message: row.message,
    createdAt: row.created_at.getTime(),
  })));
});

// Send global chat message (auth only)
app.post('/api/global-chat', authRequired, async (req, res) => {
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
    username,
    message: cleanMessage,
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
