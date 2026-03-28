import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

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
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS time_forfeit_player INTEGER;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS contact_link TEXT NOT NULL DEFAULT '';
      ALTER TABLE games ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE games ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS move_number INTEGER;
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

  // Push subscriptions table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, endpoint)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_push_user_id ON push_subscriptions(user_id);`);
}

export { pool, ensureSchema };
