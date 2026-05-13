/**
 * Server-side opening-explorer indexer.
 *
 * indexRoom(pool, roomId) reads a finished game from the rooms table, runs
 * it through the shared tree-indexer, and writes the resulting entries to
 * position_moves (aggregates) and position_games (per-game tuples) in a
 * single transaction. Idempotent via the rooms.explorer_indexed_at marker.
 */

import { indexGameTree } from '../shared/explorer/indexer.js';

/**
 * Index one room's main-line game tree. No-op if:
 *  - the room doesn't exist,
 *  - the game has no winner (unfinished or in-progress),
 *  - the winner is 0 (cancelled), or
 *  - the room has already been indexed (explorer_indexed_at set).
 *
 * Returns { indexed: true, entries: N } on success or { indexed: false,
 * reason } on a no-op.
 */
export async function indexRoom(pool, roomId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Atomically claim the indexing slot in one statement: only the first
    // caller to flip explorer_indexed_at from NULL succeeds. Concurrent
    // callers see rowCount === 0 and bail out cleanly. The UPDATE happens
    // inside the transaction, so any INSERT failure rolls back the claim too
    // and the row becomes eligible for retry.
    const claim = await client.query(
      `UPDATE rooms
          SET explorer_indexed_at = NOW()
        WHERE id = $1
          AND explorer_indexed_at IS NULL
          AND winner IS NOT NULL
          AND winner <> 0
       RETURNING id, board_size, tree_json, user1_id, user2_id, winner`,
      [roomId]
    );

    if (claim.rowCount === 0) {
      await client.query('ROLLBACK');
      // Distinguish "nothing to do" from "actually missing" for the caller.
      const probe = await pool.query(
        `SELECT explorer_indexed_at, winner FROM rooms WHERE id = $1`,
        [roomId]
      );
      if (probe.rowCount === 0) return { indexed: false, reason: 'not_found' };
      if (probe.rows[0].explorer_indexed_at != null) return { indexed: false, reason: 'already_indexed' };
      return { indexed: false, reason: 'no_winner' };
    }

    const room = claim.rows[0];

    let tree;
    try {
      tree = JSON.parse(room.tree_json);
    } catch {
      await client.query('ROLLBACK');
      return { indexed: false, reason: 'bad_tree_json' };
    }

    const entries = indexGameTree(tree, room.board_size);
    if (entries.length === 0) {
      // Empty tree — keep the claim so we don't reprocess.
      await client.query('COMMIT');
      return { indexed: true, entries: 0 };
    }

    const winnerNum = room.winner; // 1 or 2
    const p1Win = winnerNum === 1 ? 1 : 0;
    const p2Win = winnerNum === 2 ? 1 : 0;
    const draw = (winnerNum !== 1 && winnerNum !== 2) ? 1 : 0;

    for (const e of entries) {
      const moveJson = JSON.stringify(e.move);

      await client.query(
        `INSERT INTO position_moves
            (position_hash, board_size, move_notation, move_json,
             total_games, player1_wins, player2_wins, draws)
          VALUES ($1, $2, $3, $4, 1, $5, $6, $7)
          ON CONFLICT (position_hash, board_size, move_notation)
          DO UPDATE SET
            total_games  = position_moves.total_games + 1,
            player1_wins = position_moves.player1_wins + EXCLUDED.player1_wins,
            player2_wins = position_moves.player2_wins + EXCLUDED.player2_wins,
            draws        = position_moves.draws + EXCLUDED.draws`,
        [e.positionHash, e.boardSize, e.moveNotation, moveJson, p1Win, p2Win, draw]
      );

      await client.query(
        `INSERT INTO position_games
            (position_hash, board_size, game_id, ply, move_notation, move_json,
             user1_id, user2_id, winner)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          e.positionHash, e.boardSize, room.id, e.ply, e.moveNotation, moveJson,
          room.user1_id, room.user2_id, winnerNum,
        ]
      );
    }

    await client.query('COMMIT');
    return { indexed: true, entries: entries.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Backfill all unindexed finished rooms. Returns a summary count.
 */
export async function backfillUnindexedRooms(pool) {
  const ids = await pool.query(
    `SELECT id FROM rooms
      WHERE winner IS NOT NULL AND winner <> 0
        AND explorer_indexed_at IS NULL
      ORDER BY id ASC`
  );
  let processed = 0;
  let totalEntries = 0;
  for (const row of ids.rows) {
    const r = await indexRoom(pool, row.id);
    if (r.indexed) {
      processed++;
      totalEntries += r.entries || 0;
    }
  }
  return { rooms: processed, entries: totalEntries };
}
