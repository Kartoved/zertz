/**
 * Re-scores old games that today's rules would have ABORTED: a timed game lost
 * on time by a player who never made a first move in time (see
 * utils/abortUnstarted.js). Such games become winner 0 / 'aborted', exactly
 * what `abortIfFirstMoveExpired` in routes/rooms.js produces today:
 *
 *   - rooms: winner 0, win_type 'aborted', state_json.winner 'cancelled',
 *     rating stamps cleared;
 *   - ratings: refunded game by game (refundRatings — each player gets back
 *     what the game moved them by, the win/loss is struck off; a player left
 *     with no rated game is reset to 1500/350). RD, volatility and streaks
 *     stay as they are;
 *   - opening explorer: their position_games rows go, position_moves counts
 *     are decremented;
 *   - the `games` copy of an online game gets the same result.
 *
 * Arena games are left alone — they are exempt from the abort rule.
 *
 *   node server/scripts/abortUnstartedGames.js            dry run: report only, changes nothing
 *   node server/scripts/abortUnstartedGames.js --apply    one transaction, after copying every
 *                                                         row it touches into bak_abort_<stamp>_* tables
 *
 * Take a pg_dump before --apply anyway.
 */

import { pool } from '../db.js';
import { isUnstartedTimeLoss, mainLineNodes, refundRatings } from '../utils/abortUnstarted.js';

const APPLY = process.argv.includes('--apply');

function withWinner(stateJson, winner) {
  try {
    const state = JSON.parse(stateJson);
    state.winner = winner;
    return JSON.stringify(state);
  } catch {
    return stateJson;
  }
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Dry run: read-only. Apply: block writers to rooms/users (reads go on) so
    // no rating moves between what we read and what we write.
    if (APPLY) await client.query('LOCK TABLE rooms, users IN EXCLUSIVE MODE');
    else await client.query('SET TRANSACTION READ ONLY');

    // ── which games ──────────────────────────────────────────────────────
    const candidates = await client.query(`
      SELECT r.id, r.winner, r.win_type, r.tree_json, r.setup_json, r.state_json, r.rated,
             r.board_size, r.player1_name, r.player2_name, r.updated_at, r.user1_id, r.user2_id,
             r.rating1_before, r.rating2_before, r.rating1_after, r.rating2_after
        FROM rooms r
       WHERE r.win_type = 'time' AND r.winner IN (1, 2)
         AND NOT EXISTS (SELECT 1 FROM tournament_games t WHERE t.room_id = r.id)
       ORDER BY r.id`);
    const affected = candidates.rows.filter(row =>
      isUnstartedTimeLoss({ winner: row.winner, winType: row.win_type, treeJson: row.tree_json, setupJson: row.setup_json }));
    const affectedIds = affected.map(row => row.id);

    console.log(`Losses on time outside arenas: ${candidates.rows.length}; lost before a first move: ${affected.length}\n`);
    for (const row of affected) {
      let plies = '?';
      try { plies = mainLineNodes(JSON.parse(row.tree_json)).length; } catch { /* unreadable tree */ }
      const loser = row.winner === 1 ? row.player2_name : row.player1_name;
      const rated = row.rating1_after != null ? 'rated  ' : row.rated ? 'rated, never applied' : 'unrated';
      console.log(`  room ${row.id}  ${row.updated_at.toISOString().slice(0, 16)}  ${row.board_size}  ${rated}  ` +
        `${row.player1_name} vs ${row.player2_name}  (${plies} plies, ${loser} flagged)`);
    }

    // ── ratings ──────────────────────────────────────────────────────────
    // Only games whose rating was actually applied carry stamps, and only
    // those moved anyone's record.
    const ratedGames = affected
      .filter(r => r.rating1_after != null && r.user1_id != null && r.user2_id != null)
      .map(r => ({
        user1Id: r.user1_id, user2Id: r.user2_id, winner: r.winner,
        rating1Before: r.rating1_before, rating1After: r.rating1_after,
        rating2Before: r.rating2_before, rating2After: r.rating2_after,
      }));
    const playerIds = [...new Set(ratedGames.flatMap(g => [g.user1Id, g.user2Id]))];
    const userRows = playerIds.length
      ? (await client.query(
        `SELECT id, username, rating, rating_rd, rating_vol, wins, losses, current_streak, best_streak
           FROM users WHERE id = ANY($1)`, [playerIds])).rows
      : [];
    const users = new Map(userRows.map(u => [u.id, {
      rating: u.rating, rd: u.rating_rd, vol: u.rating_vol, wins: u.wins, losses: u.losses,
      currentStreak: u.current_streak, bestStreak: u.best_streak,
    }]));
    const names = new Map(userRows.map(u => [u.id, u.username]));
    const refunded = refundRatings(ratedGames, users);

    console.log(`\nPlayers whose rating record changes: ${refunded.size}`);
    for (const [id, after] of refunded) {
      const before = users.get(id);
      const reset = after.rd !== before.rd ? '  (no rated game left: fresh record)' : '';
      console.log(`  ${names.get(id)}: rating ${Math.round(before.rating)} → ${Math.round(after.rating)}, ` +
        `W/L ${before.wins}/${before.losses} → ${after.wins}/${after.losses}${reset}`);
    }

    const explorerRows = affectedIds.length
      ? (await client.query('SELECT position_hash, board_size, move_notation, winner FROM position_games WHERE game_id = ANY($1)', [affectedIds])).rows
      : [];
    const gameCopies = affectedIds.length
      ? (await client.query('SELECT id, state_json FROM games WHERE is_online AND id = ANY($1::text[])', [affectedIds.map(String)])).rows
      : [];
    console.log(`Opening-explorer entries to remove: ${explorerRows.length}`);
    console.log(`Copies in the games table: ${gameCopies.length}`);

    if (!APPLY || affected.length === 0) {
      await client.query('ROLLBACK');
      console.log(APPLY ? '\nNothing to do.' : '\nDry run — nothing was changed. Re-run with --apply to write it.');
      return;
    }

    // ── backups inside the database, same transaction ────────────────────
    const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 12);
    const bak = table => `bak_abort_${stamp}_${table}`;
    await client.query(`CREATE TABLE ${bak('rooms')} AS SELECT * FROM rooms WHERE id = ANY($1)`, [affectedIds]);
    await client.query(`CREATE TABLE ${bak('users')} AS SELECT * FROM users WHERE id = ANY($1)`, [playerIds]);
    await client.query(`CREATE TABLE ${bak('games')} AS SELECT * FROM games WHERE id = ANY($1::text[])`, [affectedIds.map(String)]);
    await client.query(`CREATE TABLE ${bak('position_games')} AS SELECT * FROM position_games WHERE game_id = ANY($1)`, [affectedIds]);
    await client.query(
      `CREATE TABLE ${bak('position_moves')} AS
         SELECT pm.* FROM position_moves pm
          WHERE (pm.position_hash, pm.board_size, pm.move_notation) IN
                (SELECT position_hash, board_size, move_notation FROM position_games WHERE game_id = ANY($1))`,
      [affectedIds]);

    // ── the writes ───────────────────────────────────────────────────────
    for (const row of affected) {
      await client.query(
        `UPDATE rooms
            SET winner = 0, win_type = 'aborted', state_json = $2,
                rating1_before = NULL, rating2_before = NULL, rating1_after = NULL, rating2_after = NULL,
                first_move_deadline = NULL, clock_running_since = NULL
          WHERE id = $1`,
        [row.id, withWinner(row.state_json, 'cancelled')]);
    }
    for (const [id, r] of refunded) {
      await client.query(
        `UPDATE users SET rating = $2, rating_rd = $3, rating_vol = $4, wins = $5, losses = $6,
                          current_streak = $7, best_streak = $8
          WHERE id = $1`,
        [id, r.rating, r.rd, r.vol, r.wins, r.losses, r.currentStreak, r.bestStreak]);
    }
    for (const e of explorerRows) {
      await client.query(
        `UPDATE position_moves
            SET total_games  = total_games - 1,
                player1_wins = player1_wins - $4,
                player2_wins = player2_wins - $5,
                draws        = draws - $6
          WHERE position_hash = $1 AND board_size = $2 AND move_notation = $3`,
        [e.position_hash, e.board_size, e.move_notation,
          e.winner === 1 ? 1 : 0, e.winner === 2 ? 1 : 0, e.winner !== 1 && e.winner !== 2 ? 1 : 0]);
    }
    await client.query('DELETE FROM position_games WHERE game_id = ANY($1)', [affectedIds]);
    await client.query('DELETE FROM position_moves WHERE total_games <= 0');
    for (const copy of gameCopies) {
      await client.query(
        `UPDATE games SET winner = 'cancelled', win_type = 'aborted', state_json = $2 WHERE id = $1`,
        [copy.id, withWinner(copy.state_json, 'cancelled')]);
    }

    await client.query('COMMIT');
    console.log(`\nApplied. The rows as they were are in ${bak('*')} ` +
      '(rooms, users, games, position_games, position_moves); drop them once you are satisfied.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

main()
  .catch(err => {
    console.error('[abort-unstarted] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
