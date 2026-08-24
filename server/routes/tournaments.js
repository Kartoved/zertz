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
    scheduleId: r.schedule_id ?? null,
    createdAt: r.created_at.getTime(),
  };
}

// Derive the DST-free recurrence (UTC weekday + minute-of-day) from the chosen
// first-run instant.
function deriveRecurrence(firstStartMs, freq) {
  const d = new Date(firstStartMs);
  return {
    utcMinute: d.getUTCHours() * 60 + d.getUTCMinutes(),
    utcWeekday: freq === 'weekly' ? d.getUTCDay() : null,
  };
}

const TOURNAMENT_COLS = `id, name, created_by, board_size, time_control_base_ms, time_control_increment_ms,
       rated, berserk_enabled, starts_at, duration_min, finishes_at, status,
       winner_user_id, schedule_id, created_at`;

// GET /api/tournaments — recent + upcoming + active arenas.
router.get('/', optionalAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${TOURNAMENT_COLS}
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
      `SELECT ${TOURNAMENT_COLS} FROM tournaments WHERE id = $1`,
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

    // Recurrence info (for the "manage series" UI) when this is a recurring instance.
    let schedule = null;
    if (tRes.rows[0].schedule_id) {
      const sRes = await pool.query(
        `SELECT id, freq, utc_weekday, utc_minute, active FROM tournament_schedules WHERE id = $1`,
        [tRes.rows[0].schedule_id]
      );
      if (sRes.rows.length > 0) {
        const s = sRes.rows[0];
        schedule = { id: s.id, freq: s.freq, utcWeekday: s.utc_weekday, utcMinute: s.utc_minute, active: s.active };
      }
    }

    res.json({ tournament: tournamentDTO(tRes.rows[0]), standings, me, schedule });
  } catch (err) {
    console.error('GET /tournaments/:id error:', err);
    res.status(500).json({ error: 'Ошибка получения турнира' });
  }
});

// GET /api/tournaments/:id/games — this tournament's games: live (with state for a
// board preview) and finished (result only; the board is fetched lazily on hover).
router.get('/:id/games', optionalAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });
  try {
    const rows = await pool.query(
      `SELECT tg.room_id, tg.user1_id, tg.user2_id, tg.p1_berserk, tg.p2_berserk,
              tg.winner_user_id, tg.created_at,
              r.board_size, r.player1_name, r.player2_name, r.winner, r.win_type,
              r.state_json, r.updated_at,
              u1.rating AS r1, u2.rating AS r2
         FROM tournament_games tg
         JOIN rooms r ON r.id = tg.room_id
         LEFT JOIN users u1 ON u1.id = tg.user1_id
         LEFT JOIN users u2 ON u2.id = tg.user2_id
        WHERE tg.tournament_id = $1
        ORDER BY tg.created_at DESC
        LIMIT 200`,
      [id]
    );

    const live = [];
    const finished = [];
    for (const r of rows.rows) {
      if (r.winner == null) {
        live.push({
          roomId: r.room_id,
          boardSize: r.board_size,
          playerNames: { player1: r.player1_name, player2: r.player2_name },
          ratings: {
            player1: r.r1 != null ? Math.round(r.r1) : null,
            player2: r.r2 != null ? Math.round(r.r2) : null,
          },
          berserk: { player1: r.p1_berserk, player2: r.p2_berserk },
          stateJson: r.state_json,
        });
      } else if (r.winner === 1 || r.winner === 2) {
        // winner 0 = cancelled/annulled — skip (didn't count toward scores).
        finished.push({
          roomId: r.room_id,
          boardSize: r.board_size,
          user1Id: r.user1_id,
          user2Id: r.user2_id,
          playerNames: { player1: r.player1_name, player2: r.player2_name },
          winnerUserId: r.winner_user_id,
          winType: r.win_type,
          berserk: { player1: r.p1_berserk, player2: r.p2_berserk },
          updatedAt: r.updated_at.getTime(),
        });
      }
    }
    res.json({ live, finished });
  } catch (err) {
    console.error('GET /tournaments/:id/games error:', err);
    res.status(500).json({ error: 'Ошибка получения партий' });
  }
});

// PUT /api/tournaments/:id — edit a not-yet-started tournament (creator only).
router.put('/:id', authRequired, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });
  const { name, startsAt, durationMin, boardSize, berserk } = req.body;

  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (!cleanName || cleanName.length > MAX_NAME) return res.status(400).json({ error: 'Invalid tournament name' });
  if (!Number.isFinite(startsAt) || startsAt > Date.now() + 30 * 24 * 60 * 60 * 1000) return res.status(400).json({ error: 'Invalid start time' });
  if (!Number.isInteger(durationMin) || durationMin < MIN_DURATION || durationMin > MAX_DURATION) return res.status(400).json({ error: 'Invalid duration' });
  if (!VALID_BOARD_SIZES.includes(Number(boardSize))) return res.status(400).json({ error: 'Invalid board size' });

  const startMs = Math.max(startsAt, Date.now());
  const finishMs = startMs + durationMin * 60 * 1000;
  try {
    const r = await pool.query(
      `UPDATE tournaments
       SET name = $3, board_size = $4, berserk_enabled = $5, starts_at = $6, duration_min = $7, finishes_at = $8
       WHERE id = $1 AND created_by = $2 AND status = 'scheduled'`,
      [id, req.user.id, cleanName, Number(boardSize), !!berserk, toPgUtc(startMs), durationMin, toPgUtc(finishMs)]
    );
    if (r.rowCount === 0) return res.status(403).json({ error: 'Нельзя изменить (не ваш или уже начался)' });
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /tournaments/:id error:', err);
    res.status(500).json({ error: 'Ошибка изменения' });
  }
});

// DELETE /api/tournaments/:id — delete a not-yet-started tournament (creator only).
// For a recurring instance this skips just that occurrence (the schedule's
// last_start_at already advanced past it, so the engine won't recreate it).
router.delete('/:id', authRequired, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });
  try {
    const r = await pool.query(
      `DELETE FROM tournaments WHERE id = $1 AND created_by = $2 AND status = 'scheduled'`,
      [id, req.user.id]
    );
    if (r.rowCount === 0) return res.status(403).json({ error: 'Нельзя удалить (не ваш или уже начался)' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /tournaments/:id error:', err);
    res.status(500).json({ error: 'Ошибка удаления' });
  }
});

// POST /api/tournaments/schedules — create a recurring arena (any logged-in user).
router.post('/schedules', createRoomLimiter, authRequired, async (req, res) => {
  const {
    name, freq, firstStartAt, durationMin,
    boardSize = 37, berserk = true, stateJson, treeJson,
  } = req.body;

  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (!cleanName || cleanName.length > MAX_NAME) return res.status(400).json({ error: 'Invalid tournament name' });
  if (freq !== 'daily' && freq !== 'weekly') return res.status(400).json({ error: 'Invalid frequency' });
  if (!Number.isFinite(firstStartAt)) return res.status(400).json({ error: 'Invalid start time' });
  if (!Number.isInteger(durationMin) || durationMin < MIN_DURATION || durationMin > MAX_DURATION) return res.status(400).json({ error: 'Invalid duration' });
  if (!VALID_BOARD_SIZES.includes(Number(boardSize))) return res.status(400).json({ error: 'Invalid board size' });
  if (!stateJson || !treeJson) return res.status(400).json({ error: 'Missing game seed' });

  const { utcMinute, utcWeekday } = deriveRecurrence(firstStartAt, freq);
  try {
    const result = await pool.query(
      `INSERT INTO tournament_schedules
         (name, created_by, board_size, time_control_base_ms, time_control_increment_ms,
          rated, berserk_enabled, duration_min, freq, utc_weekday, utc_minute, state_json, tree_json)
       VALUES ($1,$2,$3,$4,$5,true,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id`,
      [cleanName, req.user.id, Number(boardSize), BLITZ_BASE_MS, BLITZ_INC_MS,
       !!berserk, durationMin, freq, utcWeekday, utcMinute, stateJson, treeJson]
    );
    res.json({ scheduleId: result.rows[0].id });
  } catch (err) {
    console.error('POST /tournaments/schedules error:', err);
    res.status(500).json({ error: 'Ошибка создания серии' });
  }
});

// PUT /api/tournaments/schedules/:id — edit a recurring series (creator only).
// Resets the upcoming materialized instance so the engine re-creates it fresh.
router.put('/schedules/:id', authRequired, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });
  const { name, freq, firstStartAt, durationMin, boardSize, berserk } = req.body;

  const cleanName = typeof name === 'string' ? name.trim() : '';
  if (!cleanName || cleanName.length > MAX_NAME) return res.status(400).json({ error: 'Invalid tournament name' });
  if (freq !== 'daily' && freq !== 'weekly') return res.status(400).json({ error: 'Invalid frequency' });
  if (!Number.isFinite(firstStartAt)) return res.status(400).json({ error: 'Invalid start time' });
  if (!Number.isInteger(durationMin) || durationMin < MIN_DURATION || durationMin > MAX_DURATION) return res.status(400).json({ error: 'Invalid duration' });
  if (!VALID_BOARD_SIZES.includes(Number(boardSize))) return res.status(400).json({ error: 'Invalid board size' });

  const { utcMinute, utcWeekday } = deriveRecurrence(firstStartAt, freq);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `UPDATE tournament_schedules
       SET name = $3, board_size = $4, berserk_enabled = $5, duration_min = $6,
           freq = $7, utc_weekday = $8, utc_minute = $9, last_start_at = NULL
       WHERE id = $1 AND created_by = $2`,
      [id, req.user.id, cleanName, Number(boardSize), !!berserk, durationMin, freq, utcWeekday, utcMinute]
    );
    if (r.rowCount === 0) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Не ваша серия' }); }
    // Drop the upcoming instance so it re-materializes with the new settings.
    await client.query(`DELETE FROM tournaments WHERE schedule_id = $1 AND status = 'scheduled'`, [id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('PUT /tournaments/schedules/:id error:', err);
    res.status(500).json({ error: 'Ошибка изменения серии' });
  } finally {
    client.release();
  }
});

// DELETE /api/tournaments/schedules/:id — stop a recurring series (creator only)
// and remove its upcoming (not-yet-started) instance.
router.delete('/schedules/:id', authRequired, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const own = await client.query(`SELECT 1 FROM tournament_schedules WHERE id = $1 AND created_by = $2`, [id, req.user.id]);
    if (own.rows.length === 0) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Не ваша серия' }); }
    await client.query(`DELETE FROM tournaments WHERE schedule_id = $1 AND status = 'scheduled'`, [id]);
    await client.query(`DELETE FROM tournament_schedules WHERE id = $1`, [id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('DELETE /tournaments/schedules/:id error:', err);
    res.status(500).json({ error: 'Ошибка удаления серии' });
  } finally {
    client.release();
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
