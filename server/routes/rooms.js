import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired, optionalAuth } from '../middleware/auth.js';
import { glicko2Update } from '../utils/glicko2.js';
import { sendPushToUser } from '../utils/pushNotifications.js';
import { indexRoom } from '../explorer.js';
import { verifySubmittedState } from '../utils/verifyState.js';

// Fire-and-forget indexer call. We never want explorer-side errors to block
// the API response, but we still want to know if it failed.
function fireExplorerIndex(roomId) {
  indexRoom(pool, roomId).catch(err => {
    console.error(`[explorer] indexRoom(${roomId}) failed:`, err);
  });
}

// Applies Glicko-2 to a finished rated room. Idempotent: uses
// `rating1_after IS NULL` as a guard so concurrent callers can't double-rate
// (the second caller's `UPDATE rooms ... WHERE rating1_after IS NULL` will
// affect 0 rows and skip the rest).
//
// Returns the rating delta object or null when no rating change applied
// (unrated room, missing seats, already rated, or any error).
async function applyGlickoForFinishedRoom(roomId, winnerNum) {
  if (winnerNum !== 1 && winnerNum !== 2) return null;
  try {
    const roomRow = await pool.query(
      'SELECT rated, user1_id, user2_id, rating1_after FROM rooms WHERE id = $1',
      [roomId]
    );
    const room = roomRow.rows[0];
    if (!room) return null;
    if (!room.rated || !room.user1_id || !room.user2_id) return null;
    if (room.rating1_after != null) return null; // already rated

    const u1Row = await pool.query(
      'SELECT id, rating, rating_rd, rating_vol, wins, losses, current_streak, best_streak FROM users WHERE id = $1',
      [room.user1_id]
    );
    const u2Row = await pool.query(
      'SELECT id, rating, rating_rd, rating_vol, wins, losses, current_streak, best_streak FROM users WHERE id = $1',
      [room.user2_id]
    );
    const u1 = u1Row.rows[0];
    const u2 = u2Row.rows[0];
    if (!u1 || !u2) return null;

    const score1 = winnerNum === 1 ? 1 : 0;
    const score2 = winnerNum === 2 ? 1 : 0;

    const new1 = glicko2Update(u1.rating, u1.rating_rd, u1.rating_vol, u2.rating, u2.rating_rd, score1);
    const new2 = glicko2Update(u2.rating, u2.rating_rd, u2.rating_vol, u1.rating, u1.rating_rd, score2);

    // Idempotency guard: only the first caller stamps rating1_after.
    const claim = await pool.query(
      `UPDATE rooms
         SET rating1_before=$2, rating2_before=$3, rating1_after=$4, rating2_after=$5
       WHERE id=$1 AND rating1_after IS NULL
       RETURNING id`,
      [roomId, Math.round(u1.rating), Math.round(u2.rating), new1.rating, new2.rating]
    );
    if (claim.rowCount === 0) return null; // someone else got here first

    const streak1 = winnerNum === 1 ? u1.current_streak + 1 : 0;
    const best1 = Math.max(u1.best_streak, streak1);
    await pool.query(
      `UPDATE users SET rating=$2, rating_rd=$3, rating_vol=$4, wins=wins+$5, losses=losses+$6, current_streak=$7, best_streak=$8 WHERE id=$1`,
      [u1.id, new1.rating, new1.rd, new1.vol, score1, score2, streak1, best1]
    );

    const streak2 = winnerNum === 2 ? u2.current_streak + 1 : 0;
    const best2 = Math.max(u2.best_streak, streak2);
    await pool.query(
      `UPDATE users SET rating=$2, rating_rd=$3, rating_vol=$4, wins=wins+$5, losses=losses+$6, current_streak=$7, best_streak=$8 WHERE id=$1`,
      [u2.id, new2.rating, new2.rd, new2.vol, score2, score1, streak2, best2]
    );

    return {
      player1: { before: Math.round(u1.rating), after: new1.rating, delta: new1.rating - Math.round(u1.rating) },
      player2: { before: Math.round(u2.rating), after: new2.rating, delta: new2.rating - Math.round(u2.rating) },
    };
  } catch (err) {
    console.error('Glicko update error:', err);
    return null;
  }
}

const router = Router();

// Get pending invite rooms (rooms where user is creator but opponent hasn't joined yet)
// NOTE: This route must be defined before /:id to avoid matching "pending" as an id
router.get('/pending', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT id, board_size, creator_player, player1_name, player2_name, rated,
              time_control_base_ms, time_control_increment_ms, created_at
       FROM rooms
       WHERE winner IS NULL
         AND ((user1_id = $1 AND user2_id IS NULL) OR (user2_id = $1 AND user1_id IS NULL))
       ORDER BY created_at DESC`,
      [userId]
    );
    res.json(result.rows.map(r => ({
      id: r.id,
      boardSize: r.board_size,
      creatorPlayer: r.creator_player,
      player1Name: r.player1_name,
      player2Name: r.player2_name,
      rated: r.rated || false,
      timeControlBaseMs: r.time_control_base_ms,
      timeControlIncrementMs: r.time_control_increment_ms,
      createdAt: r.created_at.getTime(),
    })));
  } catch (err) {
    console.error('Get pending rooms error:', err);
    res.status(500).json({ error: 'Failed to get pending rooms' });
  }
});

// Public list of all rooms waiting for an opponent (no auth required)
router.get('/open', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, board_size, creator_player, player1_name, player2_name, rated,
              time_control_base_ms, time_control_increment_ms, created_at
       FROM rooms
       WHERE winner IS NULL AND (user1_id IS NULL OR user2_id IS NULL)
       ORDER BY created_at DESC
       LIMIT 50`
    );
    res.json(result.rows.map(r => ({
      id: r.id,
      boardSize: r.board_size,
      creatorPlayer: r.creator_player,
      player1Name: r.player1_name,
      player2Name: r.player2_name,
      rated: r.rated || false,
      timeControlBaseMs: r.time_control_base_ms,
      timeControlIncrementMs: r.time_control_increment_ms,
      createdAt: r.created_at.getTime(),
    })));
  } catch (err) {
    console.error('Get open rooms error:', err);
    res.status(500).json({ error: 'Failed to get open rooms' });
  }
});

// Create a new room
router.post('/', optionalAuth, async (req, res) => {
  const {
    boardSize = 37,
    creatorPlayer = 1,
    stateJson,
    treeJson,
    rated = true,
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

  if (isTimed && (timeControlBaseMs <= 0 || (timeControlIncrementMs < 0 && timeControlIncrementMs !== -1))) {
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

// Get active rooms for a specific player username (for spectating)
// All active rooms (no username filter). Optional ?username= narrows the list.
router.get('/active', async (req, res) => {
  const { username } = req.query;
  const params = [];
  let where = 'WHERE winner IS NULL AND user2_id IS NOT NULL';
  if (username) {
    where += ' AND (player1_name = $1 OR player2_name = $1)';
    params.push(username);
  }
  const result = await pool.query(
    `SELECT id, board_size, player1_name, player2_name, updated_at
       FROM rooms
       ${where}
      ORDER BY updated_at DESC
      LIMIT 100`,
    params
  );
  res.json(result.rows.map(r => ({
    id: String(r.id),
    playerNames: { player1: r.player1_name, player2: r.player2_name },
    updatedAt: r.updated_at.getTime(),
    moveCount: 0,
    winner: null,
    winType: null,
    boardSize: r.board_size,
    isOnline: true,
  })));
});

// Back-compat: /active/:username — same as /active?username=...
router.get('/active/:username', async (req, res) => {
  const { username } = req.params;
  const result = await pool.query(
    `SELECT id, board_size, player1_name, player2_name, updated_at
     FROM rooms
     WHERE winner IS NULL
       AND user2_id IS NOT NULL
       AND (player1_name = $1 OR player2_name = $1)
     ORDER BY updated_at DESC
     LIMIT 20`,
    [username]
  );
  res.json(result.rows.map(r => ({
    id: String(r.id),
    playerNames: { player1: r.player1_name, player2: r.player2_name },
    updatedAt: r.updated_at.getTime(),
    moveCount: 0,
    winner: null,
    winType: null,
    boardSize: r.board_size,
    isOnline: true,
  })));
});

// Lightweight "did anything change?" check used by pollRoom to skip a full
// fetch when the room is unchanged. Returns { updatedAt, winner } only.
// Must be defined before /:id so Express doesn't match "head" as an id.
router.get('/:id/head', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT updated_at, winner FROM rooms WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    const row = result.rows[0];
    res.json({
      updatedAt: row.updated_at.getTime(),
      winner: row.winner,
    });
  } catch (err) {
    console.error('Error getting room head:', err);
    res.status(500).json({ error: 'Failed to get room head' });
  }
});

router.get('/:id', async (req, res) => {
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
        // `AND winner IS NULL` makes the timeout transition atomic — two
        // concurrent readers racing to detect the same timeout won't both
        // flip the row and won't both trigger explorer indexing / Glicko.
        const timeoutResult = await pool.query(
          `UPDATE rooms
             SET winner = $2,
                 win_type = 'time',
                 current_player = $3,
                 clock_p1_ms = $4,
                 clock_p2_ms = $5,
                 clock_running_since = NULL,
                 updated_at = NOW()
           WHERE id = $1 AND winner IS NULL
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
          fireExplorerIndex(id);
          // Apply Glicko for timed games — without this, a player losing on
          // time would skip the rating update entirely.
          await applyGlickoForFinishedRoom(id, winner);
          // Re-fetch ratings columns now that they may have been stamped.
          const refreshed = await pool.query(
            `SELECT rating1_before, rating1_after, rating2_before, rating2_after FROM rooms WHERE id = $1`,
            [id]
          );
          if (refreshed.rows.length > 0) {
            row.rating1_before = refreshed.rows[0].rating1_before;
            row.rating1_after = refreshed.rows[0].rating1_after;
            row.rating2_before = refreshed.rows[0].rating2_before;
            row.rating2_after = refreshed.rows[0].rating2_after;
          }
        } else {
          // Another reader already flipped the row — pull the up-to-date copy.
          const refreshed = await pool.query('SELECT * FROM rooms WHERE id = $1', [id]);
          if (refreshed.rows.length > 0) row = refreshed.rows[0];
        }
      }
    }

    // Fetch both player ratings in one query.
    let user1Rating = null;
    let user2Rating = null;
    const playerIds = [row.user1_id, row.user2_id].filter(Boolean);
    if (playerIds.length > 0) {
      const uRatings = await pool.query(
        'SELECT id, rating FROM users WHERE id = ANY($1::int[])',
        [playerIds]
      );
      for (const u of uRatings.rows) {
        if (String(u.id) === String(row.user1_id)) user1Rating = Math.round(u.rating);
        if (String(u.id) === String(row.user2_id)) user2Rating = Math.round(u.rating);
      }
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
router.put('/:id/state', authRequired, async (req, res) => {
  const { id } = req.params;
  const { stateJson, treeJson, currentPlayer, winner, winType, isUndo } = req.body;

  const roomCheck = await pool.query(
    `SELECT
      board_size,
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

  if (room.winner !== null) {
    res.status(400).json({ error: 'Игра уже завершена' });
    return;
  }

  // Derive playerIndex from the authenticated user's seat — never trust the body.
  const authUserId = Number(req.user.id);
  let playerIndex = null;
  if (room.user1_id && Number(room.user1_id) === authUserId) playerIndex = 1;
  else if (room.user2_id && Number(room.user2_id) === authUserId) playerIndex = 2;

  if (!playerIndex) {
    res.status(403).json({ error: 'Нельзя ходить за другого игрока' });
    return;
  }
  if (room.current_player !== playerIndex) {
    res.status(403).json({ error: 'Не ваш ход' });
    return;
  }

  // Verify that the client-submitted state matches what we'd derive by replaying
  // the tree on the server. Prevents tampering with captures/winner/etc on the
  // way to a rated outcome.
  const verifyResult = verifySubmittedState({
    stateJson,
    treeJson,
    boardSize: room.board_size,
    winType,
    playerIndex,
  });
  if (!verifyResult.ok) {
    console.warn(`[rooms] state verification failed for room ${id}, player ${playerIndex}: ${verifyResult.reason}`);
    res.status(400).json({ error: 'Состояние не прошло проверку', reason: verifyResult.reason });
    return;
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

  // For undo moves: preserve both clock values as-is; only restart clockRunningSince
  // so the restored player's clock begins ticking from now (no time penalty for either side).
  if (isTimedGame && !isUndo) {
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
        if (didTurnPass && incrementMs === -1) {
          nextClockP1 = baseMs;
        } else {
          nextClockP1 = afterSpent + (didTurnPass ? incrementMs : 0);
        }
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
        if (didTurnPass && incrementMs === -1) {
          nextClockP2 = baseMs;
        } else {
          nextClockP2 = afterSpent + (didTurnPass ? incrementMs : 0);
        }
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

  // Index the finished game for the opening explorer (fire-and-forget;
  // skips cancelled games via indexRoom's own checks).
  if (nextWinner && nextWinType !== 'cancelled') {
    fireExplorerIndex(id);
  }

  // Glicko-2 rating update for rated games when winner is determined (not for cancelled games)
  if (nextWinner && nextWinType !== 'cancelled') {
    ratingDelta = await applyGlickoForFinishedRoom(id, nextWinner);
  }

  // Try to auto-execute a conditional pre-move for the player whose turn just started.
  // Only runs for correspondence games (incrementMs === -1) and when the live move
  // didn't end the game.
  let autoTriggered = false;
  if (!nextWinner && nextCurrentPlayer && playerIndex) {
    try {
      autoTriggered = await tryAutoExecutePremove(id, nextCurrentPlayer, playerIndex);
    } catch (err) {
      console.error('Premove auto-execute error:', err);
    }
  }

  // Push notification to the opponent (next player to move).
  // If a pre-move auto-fired, the "next player to move" is now the original mover —
  // notify them instead.
  if (!nextWinner) {
    try {
      // Re-read current_player after possible auto-execute
      const nowRow = await pool.query('SELECT current_player, player1_name, player2_name FROM rooms WHERE id = $1', [id]);
      if (nowRow.rows.length > 0) {
        const { current_player, player1_name, player2_name } = nowRow.rows[0];
        const opponentId = current_player === 1 ? room.user1_id : room.user2_id;
        if (opponentId) {
          const moverName = autoTriggered
            ? (current_player === 1 ? player2_name : player1_name)
            : (playerIndex === 1 ? player1_name : player2_name);
          sendPushToUser(opponentId, {
            type: 'your_turn',
            title: 'Zertz',
            body: `${moverName} сделал ход — твоя очередь!`,
            roomId: id,
          });
        }
      }
    } catch (err) {
      console.error('push turn notify error:', err);
    }
  }

  res.json({ ok: true, ratingDelta });
});

// ==================== Pre-move auto-execution ====================

function movesEqual(a, b) {
  if (!a || !b || a.type !== b.type) return false;
  if (a.type === 'placement') {
    return a.data.marbleColor === b.data.marbleColor
      && a.data.ringId === b.data.ringId
      && (a.data.removedRingId ?? null) === (b.data.removedRingId ?? null);
  }
  if (a.type === 'capture') {
    if (a.data.from !== b.data.from || a.data.to !== b.data.to || a.data.captured !== b.data.captured) {
      return false;
    }
    const aChain = a.data.chain || [];
    const bChain = b.data.chain || [];
    if (aChain.length !== bChain.length) return false;
    for (let i = 0; i < aChain.length; i++) {
      if (aChain[i].from !== bChain[i].from || aChain[i].to !== bChain[i].to || aChain[i].captured !== bChain[i].captured) {
        return false;
      }
    }
    return true;
  }
  return false;
}

function findDeepestMainLineNode(node) {
  if (!node || !Array.isArray(node.children) || node.children.length === 0) return node;
  return findDeepestMainLineNode(node.children[0]);
}

// Returns true if a pre-move was auto-triggered (and the room state changed).
async function tryAutoExecutePremove(roomId, ownerPlayer, opponentPlayer) {
  const result = await pool.query(
    `SELECT premoves_json, tree_json, time_control_increment_ms, time_control_base_ms,
            clock_p1_ms, clock_p2_ms, user1_id, user2_id
     FROM rooms WHERE id = $1`,
    [roomId]
  );
  if (result.rows.length === 0) return false;
  const room = result.rows[0];

  // Only correspondence games (clock resets each turn).
  const incrementMs = Number(room.time_control_increment_ms);
  if (incrementMs !== -1) return false;

  let premoves;
  try {
    premoves = JSON.parse(room.premoves_json || '{}');
  } catch {
    return false;
  }
  if (!premoves || typeof premoves !== 'object') return false;
  premoves.player1 = Array.isArray(premoves.player1) ? premoves.player1 : [];
  premoves.player2 = Array.isArray(premoves.player2) ? premoves.player2 : [];

  const variants = ownerPlayer === 1 ? premoves.player1 : premoves.player2;
  if (variants.length === 0) return false;

  // Extract the just-played move from the tree (last node in the main line).
  let tree;
  try {
    tree = JSON.parse(room.tree_json);
  } catch {
    return false;
  }
  const lastNode = findDeepestMainLineNode(tree);
  if (!lastNode || !lastNode.move) return false;

  // Find a variant whose first step matches the just-played move.
  let matchedIdx = -1;
  for (let i = 0; i < variants.length; i++) {
    const seq = variants[i].sequence;
    if (!Array.isArray(seq) || seq.length < 2) continue;
    if (movesEqual(seq[0].move, lastNode.move)) {
      matchedIdx = i;
      break;
    }
  }

  if (matchedIdx === -1) {
    // No variant matched — invalidate all variants of the owner (their plan is off-track).
    if (ownerPlayer === 1) premoves.player1 = [];
    else premoves.player2 = [];
    await pool.query('UPDATE rooms SET premoves_json = $2 WHERE id = $1', [roomId, JSON.stringify(premoves)]);
    return false;
  }

  const matched = variants[matchedIdx];
  const responseStep = matched.sequence[1];

  // Refuse to auto-trigger a winning response — keep Glicko/rating updates on the
  // user's explicit move path.
  if (responseStep.newWinner != null) {
    if (ownerPlayer === 1) premoves.player1 = [];
    else premoves.player2 = [];
    await pool.query('UPDATE rooms SET premoves_json = $2 WHERE id = $1', [roomId, JSON.stringify(premoves)]);
    return false;
  }

  // Append a new node for the response under lastNode.
  const responseNode = {
    id: `auto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    moveNumber: (lastNode.moveNumber ?? 0) + 1,
    player: responseStep.player,
    move: responseStep.move,
    notation: responseStep.notation,
    children: [],
    parent: null,
    isMainLine: lastNode.children.length === 0,
  };
  if (!Array.isArray(lastNode.children)) lastNode.children = [];
  lastNode.children.push(responseNode);

  // Advance the matched variant by 2; drop other variants (now off-track).
  const remaining = matched.sequence.slice(2);
  const newVariants = remaining.length > 0 ? [{ id: matched.id, sequence: remaining }] : [];
  if (ownerPlayer === 1) premoves.player1 = newVariants;
  else premoves.player2 = newVariants;

  // Clock: in correspondence, the moving player's clock resets to base for next turn.
  // After the auto-response, the OPPONENT moves next, so their clock resets.
  const baseMs = Number(room.time_control_base_ms);
  let nextClockP1 = room.clock_p1_ms == null ? baseMs : Number(room.clock_p1_ms);
  let nextClockP2 = room.clock_p2_ms == null ? baseMs : Number(room.clock_p2_ms);
  if (opponentPlayer === 1) nextClockP1 = baseMs;
  else nextClockP2 = baseMs;

  await pool.query(
    `UPDATE rooms SET
       state_json = $2,
       tree_json = $3,
       current_player = $4,
       clock_p1_ms = $5,
       clock_p2_ms = $6,
       clock_running_since = NOW(),
       premoves_json = $7,
       updated_at = NOW()
     WHERE id = $1`,
    [
      roomId,
      responseStep.newStateJson,
      JSON.stringify(tree),
      responseStep.newCurrentPlayer,
      nextClockP1,
      nextClockP2,
      JSON.stringify(premoves),
    ]
  );

  return true;
}

// Update player name — only the user sitting in that seat may rename it.
router.put('/:id/players/:index', authRequired, async (req, res) => {
  const { id, index } = req.params;
  const { name } = req.body;
  const playerIndex = parseInt(index, 10);

  if (playerIndex !== 1 && playerIndex !== 2) {
    res.status(400).json({ error: 'Invalid player index' });
    return;
  }
  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Invalid name' });
    return;
  }

  const seatResult = await pool.query(
    `SELECT user1_id, user2_id FROM rooms WHERE id = $1`,
    [id]
  );
  if (seatResult.rows.length === 0) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  const { user1_id, user2_id } = seatResult.rows[0];
  const seatOwner = playerIndex === 1 ? user1_id : user2_id;
  const authUserId = Number(req.user.id);
  // Allow the seat owner to rename; also allow claiming a name on an empty seat
  // (used by createRoom / joinRoom flows before user1_id/user2_id is set).
  if (seatOwner != null && Number(seatOwner) !== authUserId) {
    res.status(403).json({ error: 'Это место занято другим игроком' });
    return;
  }

  const column = playerIndex === 1 ? 'player1_name' : 'player2_name';
  const cleanName = name.trim().slice(0, 64);
  await pool.query(
    `UPDATE rooms SET ${column} = $2, updated_at = NOW() WHERE id = $1`,
    [id, cleanName]
  );

  res.json({ ok: true });
});

// Join room as authenticated user (assign user_id to correct slot)
router.put('/:id/join', optionalAuth, async (req, res) => {
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

// Get chat messages for a room
router.get('/:id/messages', async (req, res) => {
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
    moveNumber: row.move_number,
    createdAt: row.created_at.getTime(),
  })));
});

// Send chat message to a room — only seated players may post, and the
// playerIndex is derived from the authenticated user (never trusted from body).
router.post('/:id/messages', authRequired, async (req, res) => {
  const { id } = req.params;
  const { message, moveNumber } = req.body;

  if (typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'Invalid message' });
    return;
  }

  const seatResult = await pool.query(
    `SELECT user1_id, user2_id FROM rooms WHERE id = $1`,
    [id]
  );
  if (seatResult.rows.length === 0) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  const { user1_id, user2_id } = seatResult.rows[0];
  const authUserId = Number(req.user.id);
  const playerIndex =
    user1_id && Number(user1_id) === authUserId ? 1 :
    user2_id && Number(user2_id) === authUserId ? 2 : null;
  if (!playerIndex) {
    res.status(403).json({ error: 'Только участники игры могут писать в чат' });
    return;
  }

  const cleanMessage = String(message).trim().slice(0, 500);

  const result = await pool.query(
    `INSERT INTO chat_messages (room_id, player_index, message, move_number)
     VALUES ($1, $2, $3, $4)
     RETURNING id, created_at`,
    [id, playerIndex, cleanMessage, moveNumber]
  );

  res.json({
    id: result.rows[0].id,
    playerIndex,
    message: cleanMessage,
    moveNumber,
    createdAt: result.rows[0].created_at.getTime(),
  });
});

// Cancel game (annul) — unilateral, only before move 3, no rating change
router.post('/:id/cancel', authRequired, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const roomResult = await pool.query(
    'SELECT user1_id, user2_id, winner, state_json FROM rooms WHERE id = $1',
    [id]
  );
  if (roomResult.rows.length === 0) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  const room = roomResult.rows[0];

  if (Number(room.user1_id) !== Number(userId) && Number(room.user2_id) !== Number(userId)) {
    res.status(403).json({ error: 'Not a player in this room' });
    return;
  }

  if (room.winner !== null) {
    res.status(400).json({ error: 'Game already finished' });
    return;
  }

  let stateData;
  try {
    stateData = JSON.parse(room.state_json);
  } catch {
    res.status(500).json({ error: 'Invalid state' });
    return;
  }

  if ((stateData.moveNumber ?? 0) > 2) {
    res.status(400).json({ error: 'Too many moves to cancel' });
    return;
  }

  // Mark as cancelled: winner = 0 (no winner), win_type = 'cancelled'
  // Update state_json to reflect winner = 'cancelled'
  stateData.winner = 'cancelled';
  const updatedStateJson = JSON.stringify(stateData);

  await pool.query(
    `UPDATE rooms SET winner = 0, win_type = 'cancelled', state_json = $2, updated_at = NOW() WHERE id = $1`,
    [id, updatedStateJson]
  );

  res.json({ ok: true });
});

// Delete room (and any linked saved game so it doesn't linger in "current games").
// Auth required: only a seated user may delete, and only when the game has not
// actually started — i.e. one seat is still empty, OR the game is already
// finished. In-progress games must use /:id/cancel or finish naturally.
router.delete('/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  const authUserId = Number(req.user.id);

  const roomResult = await pool.query(
    'SELECT user1_id, user2_id, winner FROM rooms WHERE id = $1',
    [id]
  );
  if (roomResult.rows.length === 0) {
    res.json({ ok: true }); // idempotent — already gone
    return;
  }
  const { user1_id, user2_id, winner } = roomResult.rows[0];

  const isParticipant =
    (user1_id && Number(user1_id) === authUserId) ||
    (user2_id && Number(user2_id) === authUserId);
  if (!isParticipant) {
    res.status(403).json({ error: 'Только участники могут удалить комнату' });
    return;
  }

  const opponentJoined = user1_id != null && user2_id != null;
  const gameFinished = winner != null;
  if (opponentJoined && !gameFinished) {
    res.status(400).json({ error: 'Игра уже идёт — используйте отмену или сдачу' });
    return;
  }

  await pool.query('DELETE FROM rooms WHERE id = $1', [id]);
  await pool.query('DELETE FROM games WHERE id = $1', [String(id)]);
  res.json({ ok: true });
});

// ==================== Conditional pre-moves ====================
// Pre-moves are alternating sequences of (expected opponent move, my response).
// Stored per player as JSON: { player1: Variant[], player2: Variant[] }
// Only the player who owns a slot can read/write their own pre-moves.

function emptyPremoves() {
  return { player1: [], player2: [] };
}

function parsePremoves(json) {
  try {
    const parsed = JSON.parse(json || '{}');
    return {
      player1: Array.isArray(parsed.player1) ? parsed.player1 : [],
      player2: Array.isArray(parsed.player2) ? parsed.player2 : [],
    };
  } catch {
    return emptyPremoves();
  }
}

// GET pre-moves for the authenticated user
router.get('/:id/premoves', authRequired, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const result = await pool.query(
    'SELECT user1_id, user2_id, premoves_json FROM rooms WHERE id = $1',
    [id]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  const room = result.rows[0];
  const myPlayer =
    Number(room.user1_id) === Number(userId) ? 1 :
    Number(room.user2_id) === Number(userId) ? 2 : null;

  if (!myPlayer) {
    res.status(403).json({ error: 'Not a player in this room' });
    return;
  }

  const all = parsePremoves(room.premoves_json);
  res.json({ variants: myPlayer === 1 ? all.player1 : all.player2 });
});

// PUT pre-moves for the authenticated user (replaces all variants)
router.put('/:id/premoves', authRequired, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { variants } = req.body;

  if (!Array.isArray(variants)) {
    res.status(400).json({ error: 'variants must be an array' });
    return;
  }

  const result = await pool.query(
    'SELECT user1_id, user2_id, premoves_json FROM rooms WHERE id = $1',
    [id]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  const room = result.rows[0];
  const myPlayer =
    Number(room.user1_id) === Number(userId) ? 1 :
    Number(room.user2_id) === Number(userId) ? 2 : null;

  if (!myPlayer) {
    res.status(403).json({ error: 'Not a player in this room' });
    return;
  }

  const all = parsePremoves(room.premoves_json);
  if (myPlayer === 1) all.player1 = variants;
  else all.player2 = variants;

  await pool.query(
    'UPDATE rooms SET premoves_json = $2 WHERE id = $1',
    [id, JSON.stringify(all)]
  );

  res.json({ ok: true });
});

export default router;
