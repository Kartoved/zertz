import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired, optionalAuth } from '../middleware/auth.js';
import { createRoomLimiter } from '../middleware/rateLimits.js';

const router = Router();

// Arena games use the blitz preset (5 min + 5 s), matching matchmaking's BASE/INC.
const BLITZ_BASE_MS = 5 * 60 * 1000;
const BLITZ_INC_MS = 5 * 1000;

const MIN_DURATION = 5;
const MAX_DURATION = 360;
const MAX_NAME = 60;
const VALID_BOARD_SIZES = [37, 48, 61];

// All TIMESTAMP columns are UTC wall-clock (see server/db.js read parser). Store
// client-supplied epoch-ms as a bare 'YYYY-MM-DD HH:MM:SS' UTC string so it
// round-trips regardless of the DB session/host timezone.
function toPgUtc(ms) {
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

function tournamentDTO(r) {
  return {
    id: r.id,
    name: r.name,
    createdBy: r.created_by,
    boardSize: r.board_size,
    timeControlBaseMs: Number(r.time_control_base_ms),
    timeControlIncrementMs: Number(r.time_control_increment_ms),
    rated: r.rated,
    berserkEnabled: r.berserk_enabled,
    startsAt: r.starts_at.getTime(),
    durationMin: r.duration_min,
    finishesAt: r.finishes_at.getTime(),
    status: r.status,
    winnerUserId: r.winner_user_id,
    createdAt: r.created_at.getTime(),
  };
}

// GET /api/tournaments — recent + upcoming + active arenas.
router.get('/', optionalAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, created_by, board_size, time_control_base_ms, time_control_increment_ms,
              rated, berserk_enabled, starts_at, duration_min, finishes_at, status,
              winner_user_id, created_at
       FROM tournaments
       WHERE status <> 'finished' OR finishes_at > NOW() - INTERVAL '1 day'
       ORDER BY starts_at DESC
       LIMIT 50`
    );
    res.json(result.rows.map(tournamentDTO));
  } catch (err) {
    console.error('GET /tournaments error:', err);
    res.status(500).json({ error: 'Ошибка получения турниров' });
  }
});

// POST /api/tournaments — create an arena (any logged-in user).
router.post('/', createRoomLimiter, authRequired, async (req, res) => {
  const {
    name, startsAt, durationMin,
    boardSize = 37, berserk = true,
    stateJson, treeJson,
  } = req.body;

  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (!cleanName || cleanName.length > MAX_NAME) {
    return res.status(400).json({ error: 'Invalid tournament name' });
  }
  if (!Number.isFinite(startsAt) || startsAt > Date.now() + 30 * 24 * 60 * 60 * 1000) {
    return res.status(400).json({ error: 'Invalid start time' });
  }
  if (!Number.isInteger(durationMin) || durationMin < MIN_DURATION || durationMin > MAX_DURATION) {
    return res.status(400).json({ error: 'Invalid duration' });
  }
  if (!VALID_BOARD_SIZES.includes(Number(boardSize))) {
    return res.status(400).json({ error: 'Invalid board size' });
  }
  if (!stateJson || !treeJson) {
    return res.status(400).json({ error: 'Missing game seed' });
  }

  // Clamp a past start to "now" so the engine starts it on the next tick.
  const startMs = Math.max(startsAt, Date.now());
  const finishMs = startMs + durationMin * 60 * 1000;

  try {
    const result = await pool.query(
      `INSERT INTO tournaments
         (name, created_by, board_size, time_control_base_ms, time_control_increment_ms,
          rated, berserk_enabled, starts_at, duration_min, finishes_at, status, state_json, tree_json)
       VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, $9, 'scheduled', $10, $11)
       RETURNING id`,
      [
        cleanName, req.user.id, Number(boardSize), BLITZ_BASE_MS, BLITZ_INC_MS,
        !!berserk, toPgUtc(startMs), durationMin, toPgUtc(finishMs), stateJson, treeJson,
      ]
    );
    res.json({ id: result.rows[0].id });
  } catch (err) {
    console.error('POST /tournaments error:', err);
    res.status(500).json({ error: 'Ошибка создания турнира' });
  }
});

// GET /api/tournaments/:id — detail + standings + caller status.
router.get('/:id', optionalAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });

  try {
    const tRes = await pool.query(
      `SELECT id, name, created_by, board_size, time_control_base_ms, time_control_increment_ms,
              rated, berserk_enabled, starts_at, duration_min, finishes_at, status,
              winner_user_id, created_at
       FROM tournaments WHERE id = $1`,
      [id]
    );
    if (tRes.rows.length === 0) return res.status(404).json({ error: 'Турнир не найден' });

    const standingsRes = await pool.query(
      `SELECT user_id, username, rating, country, score, streak, games_played, paused, current_room_id
       FROM tournament_players
       WHERE tournament_id = $1
       ORDER BY score DESC, streak DESC, rating DESC`,
      [id]
    );
    const standings = standingsRes.rows.map((p, i) => ({
      rank: i + 1,
      userId: p.user_id,
      username: p.username,
      rating: Math.round(p.rating),
      country: p.country,
      score: p.score,
      streak: p.streak,
      gamesPlayed: p.games_played,
      paused: p.paused,
      playing: p.current_room_id != null,
    }));

    let me = null;
    if (req.user) {
      const mine = standingsRes.rows.find(p => p.user_id === req.user.id);
      me = mine
        ? { joined: true, paused: mine.paused, currentRoomId: mine.current_room_id }
        : { joined: false, paused: false, currentRoomId: null };
    }

    res.json({ tournament: tournamentDTO(tRes.rows[0]), standings, me });
  } catch (err) {
    console.error('GET /tournaments/:id error:', err);
    res.status(500).json({ error: 'Ошибка получения турнира' });
  }
});

// POST /api/tournaments/:id/join — join (or rejoin/unpause).
router.post('/:id/join', authRequired, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });

  try {
    const tRes = await pool.query('SELECT status FROM tournaments WHERE id = $1', [id]);
    if (tRes.rows.length === 0) return res.status(404).json({ error: 'Турнир не найден' });
    if (tRes.rows[0].status === 'finished') {
      return res.status(400).json({ error: 'Турнир завершён' });
    }

    const uRes = await pool.query('SELECT username, rating, country FROM users WHERE id = $1', [req.user.id]);
    if (uRes.rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });
    const { username, rating, country } = uRes.rows[0];

    // Rejoin unpauses; existing score/streak are preserved.
    await pool.query(
      `INSERT INTO tournament_players (tournament_id, user_id, username, rating, country, paused)
       VALUES ($1, $2, $3, $4, $5, false)
       ON CONFLICT (tournament_id, user_id)
       DO UPDATE SET paused = false, username = EXCLUDED.username,
                     rating = EXCLUDED.rating, country = EXCLUDED.country`,
      [id, req.user.id, username, Math.round(rating), country]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /tournaments/:id/join error:', err);
    res.status(500).json({ error: 'Ошибка входа в турнир' });
  }
});

// POST /api/tournaments/:id/pause — stop seeking pairings (current game continues).
router.post('/:id/pause', authRequired, async (req, res) => {
  await setPaused(req, res, true);
});

// POST /api/tournaments/:id/resume — resume seeking pairings.
router.post('/:id/resume', authRequired, async (req, res) => {
  await setPaused(req, res, false);
});

async function setPaused(req, res, paused) {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });
  try {
    const r = await pool.query(
      `UPDATE tournament_players SET paused = $3
       WHERE tournament_id = $1 AND user_id = $2`,
      [id, req.user.id, paused]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Вы не в турнире' });
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /tournaments/:id/pause error:', err);
    res.status(500).json({ error: 'Ошибка' });
  }
}

export default router;
