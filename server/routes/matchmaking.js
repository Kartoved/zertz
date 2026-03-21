import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

// In-memory matchmaking queue
// { userId: { boardSize, timeControl, rating, joinedAt, stateJson, treeJson } }
const matchQueue = {};
// Store results for polling clients: { userId: roomId }
const matchedRooms = {};

router.post('/join', authRequired, async (req, res) => {
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
      'correspondence': 7 * 24 * 60 * 60 * 1000
    };
    const incMap = {
      'blitz': 5 * 1000,
      'rapid': 0,
      'long': 0,
      'correspondence': -1
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

router.get('/status', authRequired, (req, res) => {
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

router.delete('/leave', authRequired, (req, res) => {
  const userId = req.user.id;
  delete matchQueue[userId];
  delete matchedRooms[userId];
  res.json({ status: 'left' });
});

export default router;
