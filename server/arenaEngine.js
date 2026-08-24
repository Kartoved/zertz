/**
 * Arena tournament engine — the first server-side background loop in the app.
 *
 * A single setInterval, started once at boot (server.js), that on each tick:
 *   1. transitions tournament windows (scheduled → active → finished),
 *   2. reconciles finished games into player scores (idempotent), and
 *   3. pairs free players into new rooms.
 *
 * All state lives in Postgres, so the loop is stateless and survives restarts.
 * The `_ticking` guard prevents overlapping ticks if one runs long. Deployment
 * is single-instance (Docker Compose); a multi-instance setup would need a DB
 * advisory lock around a tick.
 */

import { pool } from './db.js';
import { applyGameResult, buildPairings, nextOccurrence } from './utils/arena.js';
import { sendPushToUser } from './utils/pushNotifications.js';
import { pgUtc } from './utils/pgTime.js';

const TICK_MS = 4000;

let _timer = null;
let _ticking = false;

export function startArenaEngine() {
  if (_timer) return;
  _timer = setInterval(() => {
    arenaTick().catch(err => console.error('[arena] tick error:', err));
  }, TICK_MS);
  console.log('[arena] engine started');
}

export function stopArenaEngine() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

async function arenaTick() {
  if (_ticking) return;
  _ticking = true;
  try {
    await materializeSchedules();
    await transitionWindows();
    await reconcileFinishedGames();
    await finalizeWinners();
    await sendReminders();
    await pairActiveTournaments();
  } finally {
    _ticking = false;
  }
}

// ── 0. materialize the next instance of each recurring schedule ───────────
async function materializeSchedules() {
  const schedules = await pool.query(
    `SELECT id, name, created_by, board_size, time_control_base_ms, time_control_increment_ms,
            rated, berserk_enabled, duration_min, freq, utc_weekday, utc_minute,
            state_json, tree_json, last_start_at
     FROM tournament_schedules WHERE active = true`
  );
  for (const s of schedules.rows) {
    // Keep exactly one upcoming instance per schedule.
    const existing = await pool.query(
      `SELECT 1 FROM tournaments WHERE schedule_id = $1 AND status = 'scheduled' LIMIT 1`,
      [s.id]
    );
    if (existing.rows.length > 0) continue;

    // Next occurrence strictly after both "now" and the last one materialized —
    // so a deleted instance is skipped rather than recreated.
    const afterMs = Math.max(Date.now(), s.last_start_at ? new Date(s.last_start_at).getTime() : 0);
    const startMs = nextOccurrence({ freq: s.freq, utcWeekday: s.utc_weekday, utcMinute: s.utc_minute }, afterMs);
    const finishMs = startMs + s.duration_min * 60 * 1000;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO tournaments
           (name, created_by, board_size, time_control_base_ms, time_control_increment_ms,
            rated, berserk_enabled, starts_at, duration_min, finishes_at, status,
            state_json, tree_json, schedule_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'scheduled',$11,$12,$13)`,
        [s.name, s.created_by, s.board_size, s.time_control_base_ms, s.time_control_increment_ms,
         s.rated, s.berserk_enabled, pgUtc(startMs), s.duration_min, pgUtc(finishMs), s.state_json, s.tree_json, s.id]
      );
      await client.query(
        `UPDATE tournament_schedules SET last_start_at = $2 WHERE id = $1`,
        [s.id, pgUtc(startMs)]
      );
      await client.query('COMMIT');
      console.log(`[arena] materialized schedule ${s.id} (${s.name}) → starts ${new Date(startMs).toISOString()}`);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[arena] materializeSchedules error:', err.message);
    } finally {
      client.release();
    }
  }
}

// ── push a "starts soon" reminder to joined players (once per tournament) ──
async function sendReminders() {
  const soon = await pool.query(
    `SELECT id, name FROM tournaments
     WHERE status = 'scheduled' AND reminder_sent = false
       AND starts_at <= NOW() + INTERVAL '2 minutes'
       AND starts_at >  NOW() - INTERVAL '1 minute'`
  );
  for (const t of soon.rows) {
    const claim = await pool.query(
      `UPDATE tournaments SET reminder_sent = true WHERE id = $1 AND reminder_sent = false RETURNING id`,
      [t.id]
    );
    if (claim.rowCount === 0) continue;
    const players = await pool.query(`SELECT user_id FROM tournament_players WHERE tournament_id = $1`, [t.id]);
    for (const p of players.rows) {
      sendPushToUser(p.user_id, {
        type: 'arena_reminder',
        title: 'Zertz',
        body: `Турнир «${t.name}» скоро начнётся!`,
        url: `/tournaments/${t.id}`,
      });
    }
    if (players.rows.length > 0) console.log(`[arena] reminded ${players.rows.length} players for t${t.id}`);
  }
}

// ── 1. window transitions ────────────────────────────────────────────────
async function transitionWindows() {
  const started = await pool.query(
    `UPDATE tournaments SET status='active'
     WHERE status='scheduled' AND starts_at <= NOW()
     RETURNING id, name`
  );
  for (const t of started.rows) {
    // Announce the start in global chat via the system actor (client renders the
    // [TOURNAMENT]… marker as a clickable card).
    await pool.query(
      `INSERT INTO global_chat_messages (user_id, username, message) VALUES (NULL, $1, $2)`,
      ['Zertz System', `[TOURNAMENT]${t.id}|${t.name}`]
    ).catch(() => {});
    console.log(`[arena] t${t.id} started: ${t.name}`);
  }
  await pool.query(`UPDATE tournaments SET status='finished' WHERE status='active' AND finishes_at <= NOW()`);
}

// ── 2. reconcile finished games into scores ──────────────────────────────
async function reconcileFinishedGames() {
  const games = await pool.query(
    `SELECT tg.id, tg.tournament_id, tg.user1_id, tg.user2_id, tg.p1_berserk, tg.p2_berserk,
            r.winner AS room_winner, r.win_type AS room_win_type, r.state_json
     FROM tournament_games tg
     JOIN rooms r ON r.id = tg.room_id
     WHERE tg.scored = false AND r.winner IS NOT NULL`
  );
  for (const g of games.rows) {
    await reconcileOne(g);
  }
}

async function reconcileOne(g) {
  // rooms.winner: 1 = user1 won, 2 = user2 won, 0 = cancelled (no winner).
  let winnerUid = null;
  if (g.room_winner === 1) winnerUid = g.user1_id;
  else if (g.room_winner === 2) winnerUid = g.user2_id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Claim the game so overlapping work can't double-score it.
    const claim = await client.query(
      `UPDATE tournament_games SET scored = true, winner_user_id = $2
       WHERE id = $1 AND scored = false RETURNING id`,
      [g.id, winnerUid]
    );
    if (claim.rowCount === 0) { await client.query('ROLLBACK'); return; }

    const pl = await client.query(
      `SELECT user_id, streak FROM tournament_players
       WHERE tournament_id = $1 AND user_id = ANY($2::int[]) FOR UPDATE`,
      [g.tournament_id, [g.user1_id, g.user2_id]]
    );
    const streakOf = Object.fromEntries(pl.rows.map(r => [r.user_id, r.streak]));

    let moveNumber = 999;
    try { moveNumber = JSON.parse(g.state_json).moveNumber ?? 999; } catch { /* keep default */ }

    const result = applyGameResult({
      winnerUserId: winnerUid,
      user1Id: g.user1_id, user2Id: g.user2_id,
      p1Streak: streakOf[g.user1_id] ?? 0,
      p2Streak: streakOf[g.user2_id] ?? 0,
      p1Berserk: g.p1_berserk, p2Berserk: g.p2_berserk,
      moveNumber,
    });

    for (const [uid, r] of [[g.user1_id, result.p1], [g.user2_id, result.p2]]) {
      await client.query(
        `UPDATE tournament_players
         SET score = score + $3, streak = $4, games_played = games_played + $5, current_room_id = NULL
         WHERE tournament_id = $1 AND user_id = $2`,
        [g.tournament_id, uid, r.scoreDelta, r.newStreak, r.played ? 1 : 0]
      );
    }

    // AFK auto-pause: a player who flagged without ever moving was away — stop
    // seeking pairings for them (they can Resume) so they don't rack up instant
    // timeout losses. Arena games start the clock immediately, so this matters.
    if (winnerUid != null && g.room_win_type === 'time') {
      const loserUid = winnerUid === g.user1_id ? g.user2_id : g.user1_id;
      const loserIsP1 = loserUid === g.user1_id;
      const loserMoves = loserIsP1 ? Math.ceil((moveNumber - 1) / 2) : Math.floor((moveNumber - 1) / 2);
      if (loserMoves <= 0) {
        await client.query(
          `UPDATE tournament_players SET paused = true WHERE tournament_id = $1 AND user_id = $2`,
          [g.tournament_id, loserUid]
        );
        console.log(`[arena] auto-paused AFK player ${loserUid} in t${g.tournament_id}`);
      }
    }

    await client.query('COMMIT');
    console.log(`[arena] scored game ${g.id} (t${g.tournament_id}) winner=${winnerUid ?? 'none'}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[arena] reconcileOne error:', err.message);
  } finally {
    client.release();
  }
}

// ── 3. finalize a finished tournament's winner once all games settled ────
async function finalizeWinners() {
  const done = await pool.query(
    `SELECT id FROM tournaments t
     WHERE status = 'finished' AND winner_user_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM tournament_games g WHERE g.tournament_id = t.id AND g.scored = false)`
  );
  for (const t of done.rows) {
    const top = await pool.query(
      `SELECT user_id FROM tournament_players
       WHERE tournament_id = $1 ORDER BY score DESC, streak DESC, rating DESC LIMIT 1`,
      [t.id]
    );
    if (top.rows.length > 0) {
      await pool.query(
        `UPDATE tournaments SET winner_user_id = $2 WHERE id = $1 AND winner_user_id IS NULL`,
        [t.id, top.rows[0].user_id]
      );
    }
  }
}

// ── 4. pairing ───────────────────────────────────────────────────────────
async function pairActiveTournaments() {
  const actives = await pool.query(
    `SELECT id, board_size, state_json, tree_json, time_control_base_ms, time_control_increment_ms
     FROM tournaments WHERE status = 'active'`
  );
  for (const t of actives.rows) {
    await pairTournament(t);
  }
}

async function pairTournament(t) {
  const free = await pool.query(
    `SELECT user_id, score, rating FROM tournament_players
     WHERE tournament_id = $1 AND paused = false AND current_room_id IS NULL`,
    [t.id]
  );
  if (free.rows.length < 2) return;

  const userIds = free.rows.map(r => r.user_id);
  const recent = await lastOpponents(t.id, userIds);
  const players = free.rows.map(r => ({ userId: r.user_id, score: r.score, rating: Number(r.rating) }));

  for (const { a, b } of buildPairings(players, recent)) {
    await createArenaGame(t, a.userId, b.userId);
  }
}

async function lastOpponents(tid, userIds) {
  if (userIds.length === 0) return {};
  const res = await pool.query(
    `SELECT DISTINCT ON (u.uid) u.uid,
            CASE WHEN g.user1_id = u.uid THEN g.user2_id ELSE g.user1_id END AS opp
     FROM (SELECT unnest($2::int[]) AS uid) u
     JOIN tournament_games g
       ON g.tournament_id = $1 AND (g.user1_id = u.uid OR g.user2_id = u.uid)
     ORDER BY u.uid, g.created_at DESC`,
    [tid, userIds]
  );
  const map = {};
  for (const row of res.rows) map[row.uid] = row.opp;
  return map;
}

async function createArenaGame(t, uidA, uidB) {
  // Randomize colours: whoever lands as user1 is player 1 (moves first).
  const [p1, p2] = Math.random() < 0.5 ? [uidA, uidB] : [uidB, uidA];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Re-check both are still free (a client could have paused / been paired
    // between the free-list select and now); lock the rows.
    const chk = await client.query(
      `SELECT user_id FROM tournament_players
       WHERE tournament_id = $1 AND user_id = ANY($2::int[])
         AND paused = false AND current_room_id IS NULL FOR UPDATE`,
      [t.id, [p1, p2]]
    );
    if (chk.rows.length < 2) { await client.query('ROLLBACK'); return; }

    const names = await client.query(`SELECT id, username FROM users WHERE id = ANY($1::int[])`, [[p1, p2]]);
    const nameById = Object.fromEntries(names.rows.map(r => [r.id, r.username]));
    const base = Number(t.time_control_base_ms);
    const inc = Number(t.time_control_increment_ms);

    // Arena games start their clock immediately (clock_running_since = NOW()).
    const room = await client.query(
      `INSERT INTO rooms
         (board_size, creator_player, state_json, tree_json, rated,
          user1_id, user2_id, player1_name, player2_name,
          time_control_base_ms, time_control_increment_ms,
          clock_p1_ms, clock_p2_ms, clock_running_since)
       VALUES ($1, 1, $2, $3, true, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       RETURNING id`,
      [t.board_size, t.state_json, t.tree_json, p1, p2, nameById[p1], nameById[p2], base, inc, base, base]
    );
    const roomId = room.rows[0].id;

    await client.query(
      `INSERT INTO tournament_games (tournament_id, room_id, user1_id, user2_id)
       VALUES ($1, $2, $3, $4)`,
      [t.id, roomId, p1, p2]
    );
    await client.query(
      `UPDATE tournament_players SET current_room_id = $3
       WHERE tournament_id = $1 AND user_id = ANY($2::int[])`,
      [t.id, [p1, p2], roomId]
    );

    await client.query('COMMIT');
    console.log(`[arena] t${t.id}: paired ${p1} vs ${p2} → room ${roomId}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[arena] createArenaGame error:', err.message);
  } finally {
    client.release();
  }
}
