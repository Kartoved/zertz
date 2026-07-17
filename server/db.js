import dotenv from 'dotenv';
import { Pool, types } from 'pg';

dotenv.config();

// All TIMESTAMP columns store UTC wall-clock values (the DB session runs in UTC
// and every write uses NOW()). By default node-postgres parses a bare
// `timestamp without time zone` (OID 1114) in the Node process's LOCAL timezone,
// which shifts every value by the host's UTC offset. On a non-UTC host (e.g. a
// dev machine at UTC+3) that made `Date.now() - new Date(clock_running_since)`
// off by hours — instantly timing out fresh timed games. Parse these as UTC so
// clock math is correct regardless of the server's local timezone.
types.setTypeParser(1114, (str) => new Date(str.replace(' ', 'T') + 'Z'));

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
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS premoves_json TEXT NOT NULL DEFAULT '{"player1":[],"player2":[]}';
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS setup_json TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP NOT NULL DEFAULT NOW();
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

  // Add email column to users (safe to re-run)
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `);

  // Magic link tokens table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS magic_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_magic_tokens_token ON magic_tokens(token);`);

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

  // Lobby slots table — open game invitations visible to all players
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lobby_slots (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      rating INTEGER NOT NULL DEFAULT 1500,
      country TEXT NOT NULL DEFAULT '🌍',
      board_size INTEGER NOT NULL DEFAULT 37,
      time_control_id TEXT NOT NULL DEFAULT 'rapid',
      time_control_base_ms BIGINT,
      time_control_increment_ms BIGINT,
      rated BOOLEAN NOT NULL DEFAULT true,
      state_json TEXT NOT NULL,
      tree_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
      UNIQUE(user_id)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_lobby_expires ON lobby_slots(expires_at);`);

  // ─── Opening explorer ────────────────────────────────────────────────
  // position_moves: aggregated counts per (canonical position, move played)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS position_moves (
      position_hash CHAR(16) NOT NULL,
      board_size INTEGER NOT NULL,
      move_notation TEXT NOT NULL,
      move_json TEXT NOT NULL,
      total_games INTEGER NOT NULL DEFAULT 0,
      player1_wins INTEGER NOT NULL DEFAULT 0,
      player2_wins INTEGER NOT NULL DEFAULT 0,
      draws INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (position_hash, board_size, move_notation)
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_position_moves_lookup ON position_moves(position_hash, board_size);`);

  // position_games: every (position, move, game) tuple — drives drill-down
  // and player-filtered queries. game_id references rooms(id).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS position_games (
      id BIGSERIAL PRIMARY KEY,
      position_hash CHAR(16) NOT NULL,
      board_size INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      ply INTEGER NOT NULL,
      move_notation TEXT NOT NULL,
      move_json TEXT NOT NULL,
      user1_id INTEGER,
      user2_id INTEGER,
      winner INTEGER,
      played_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_position_games_hash ON position_games(position_hash, board_size);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_position_games_game ON position_games(game_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_position_games_user1 ON position_games(user1_id) WHERE user1_id IS NOT NULL;`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_position_games_user2 ON position_games(user2_id) WHERE user2_id IS NOT NULL;`);

  // Idempotency marker: stamp rooms once they've been processed by the
  // indexer, so re-runs (manual backfill, double-fired hooks) don't double-
  // count a game.
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS explorer_indexed_at TIMESTAMP;
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `);

  // Blog announcements: tracks which posts have already been pushed to global
  // chat so re-runs of the announce script don't duplicate.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blog_announced (
      slug TEXT PRIMARY KEY,
      announced_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // Matchmaking queue — survives server restarts and supports multiple instances.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS matchmaking_queue (
      user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      board_size  INTEGER NOT NULL,
      time_control TEXT NOT NULL,
      rating      REAL NOT NULL,
      state_json  TEXT NOT NULL,
      tree_json   TEXT NOT NULL,
      joined_at   TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // Matchmaking results — temporary holding area until the client polls /status.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS matchmaking_results (
      user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      room_id     INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      matched_at  TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // Studies: Lichess-style interactive lessons. Every row is a Notion-like node
  // that both holds content (a starting position + a move tree with markdown
  // comments) AND can nest under another node (parent_id). `slug` is a
  // user-editable, per-owner-unique handle used in the URL /studies/:owner/:slug.
  // `sort` is a fractional index so drag-reorder rewrites only the moved node.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS studies (
      id            SERIAL PRIMARY KEY,
      owner_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      parent_id     INTEGER REFERENCES studies(id) ON DELETE CASCADE,
      slug          TEXT NOT NULL,
      title         TEXT NOT NULL,
      board_size    SMALLINT NOT NULL DEFAULT 37,
      setup_json    TEXT NOT NULL,
      tree_json     TEXT NOT NULL,
      root_comment  TEXT,
      meta_json     JSONB,
      is_public     BOOLEAN NOT NULL DEFAULT false,
      sort          DOUBLE PRECISION NOT NULL DEFAULT 0,
      created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS studies_owner_slug ON studies(owner_id, slug);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS studies_owner_parent ON studies(owner_id, parent_id, sort);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS studies_public_idx ON studies(is_public) WHERE is_public;`);
}

export { pool, ensureSchema };
