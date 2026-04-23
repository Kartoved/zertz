import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired, optionalAuth } from '../middleware/auth.js';
import { glicko2Update } from '../utils/glicko2.js';
import { sendPushToUser } from '../utils/pushNotifications.js';

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

// Create a new room
router.post('/', optionalAuth, async (req, res) => {
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
router.put('/:id/state', optionalAuth, async (req, res) => {
  const { id } = req.params;
  const { stateJson, treeJson, currentPlayer, winner, winType, playerIndex, isUndo } = req.body;

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

  if (room.winner !== null) {
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

  // Glicko-2 rating update for rated games when winner is determined (not for cancelled games)
  if (nextWinner && nextWinType !== 'cancelled') {
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

  // Push notification to the opponent (next player to move)
  if (!nextWinner) {
    try {
      const opponentId = nextCurrentPlayer === 1 ? room.user1_id : room.user2_id;
      if (opponentId) {
        const roomInfo = await pool.query(
          'SELECT player1_name, player2_name FROM rooms WHERE id = $1', [id]
        );
        if (roomInfo.rows.length > 0) {
          const { player1_name, player2_name } = roomInfo.rows[0];
          const moverName = playerIndex === 1 ? player1_name : player2_name;
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

// Update player name
router.put('/:id/players/:index', async (req, res) => {
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

// Send chat message to a room
router.post('/:id/messages', async (req, res) => {
  const { id } = req.params;
  const { playerIndex, message, moveNumber } = req.body;

  if (!message || (playerIndex !== 1 && playerIndex !== 2)) {
    res.status(400).json({ error: 'Invalid message or player' });
    return;
  }

  const result = await pool.query(
    `INSERT INTO chat_messages (room_id, player_index, message, move_number)
     VALUES ($1, $2, $3, $4)
     RETURNING id, created_at`,
    [id, playerIndex, message, moveNumber]
  );

  res.json({
    id: result.rows[0].id,
    playerIndex,
    message,
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

// Delete room (and any linked saved game so it doesn't linger in "current games")
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  await pool.query('DELETE FROM rooms WHERE id = $1', [id]);
  await pool.query('DELETE FROM games WHERE id = $1', [String(id)]);
  res.json({ ok: true });
});

export default router;
