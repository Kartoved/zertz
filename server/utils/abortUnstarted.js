/**
 * Which finished games would today's rules have ABORTED instead of scoring?
 *
 * Since the Lichess-style start (rooms.js, `abortIfFirstMoveExpired`) a timed
 * game whose side to move misses its FIRST move is aborted: winner 0, win_type
 * 'aborted', no rating. Before that, the clock ran from the join and such a
 * player simply lost on time. `server/scripts/abortUnstartedGames.js` re-scores
 * those old games; this is its pure test of a single game.
 *
 * Only losses on time count — a resignation before the first move was a
 * deliberate act, and the game could have been cancelled instead. Arena games
 * are the caller's business: they are exempt from the abort rule.
 */

/** The main line of a stored game tree, root excluded. */
export function mainLineNodes(tree) {
  const nodes = [];
  let node = tree;
  while (node && Array.isArray(node.children) && node.children.length > 0) {
    node = node.children[0];
    if (node && node.move) nodes.push(node);
  }
  return nodes;
}

/**
 * True when the game was lost on time by a player who had not made a first
 * move in time. Two shapes: the loser has no move at all (flagged while
 * thinking), or their only move is the game's last one — a first move sent
 * after the clock had already run out, which the old PUT /state recorded and
 * then scored as a loss on time.
 */
export function isUnstartedTimeLoss({ winner, winType, treeJson, setupJson }) {
  if (winType !== 'time' || (winner !== 1 && winner !== 2)) return false;

  let tree;
  try { tree = typeof treeJson === 'string' ? JSON.parse(treeJson) : treeJson; }
  catch { return false; }
  const nodes = mainLineNodes(tree);

  let firstMover = 'player1';
  if (setupJson) {
    try { firstMover = JSON.parse(setupJson).currentPlayer ?? 'player1'; } catch { /* standard start */ }
  }
  const other = player => (player === 'player1' ? 'player2' : 'player1');
  // Nodes carry who moved; an old node without it is placed by alternation.
  const owners = nodes.map((node, i) => node.player ?? (i % 2 === 0 ? firstMover : other(firstMover)));

  const loser = winner === 1 ? 'player2' : 'player1';
  const loserPlies = owners.flatMap((owner, i) => (owner === loser ? [i] : []));
  return loserPlies.length === 0 || (loserPlies.length === 1 && loserPlies[0] === nodes.length - 1);
}

/** A user's rating record before any rated game (the users table defaults). */
export const FRESH_PLAYER = { rating: 1500, rd: 350, vol: 0.06, wins: 0, losses: 0, currentStreak: 0, bestStreak: 0 };

/**
 * Takes the given rated games out of the players' records, Lichess-refund
 * style: each player gets back exactly what the game moved their rating by
 * (the room's own before/after stamps), and the win or loss is struck off.
 *
 * Not a replay of the history from scratch. Glicko-2 is path-dependent, so the
 * exact counterfactual would rewrite everyone's later ratings — and it is not
 * reconstructible anyway: rooms get deleted, and `updated_at` is not the order
 * the ratings were applied in. A refund is exact for the game itself and
 * leaves RD, volatility and streaks as they are. A player left with no rated
 * game at all is reset to a fresh record, which IS exact.
 *
 * @param games  rated games with their stamps: {user1Id, user2Id, winner,
 *               rating1Before, rating1After, rating2Before, rating2After}
 * @param users  Map id → {rating, rd, vol, wins, losses, currentStreak, bestStreak}
 * @returns Map id → the record after the refund, for every player in `games`
 */
export function refundRatings(games, users) {
  const out = new Map();
  for (const game of games) {
    for (const seat of [1, 2]) {
      const id = seat === 1 ? game.user1Id : game.user2Id;
      if (!out.has(id)) out.set(id, { ...users.get(id) });
      const record = out.get(id);
      const before = seat === 1 ? game.rating1Before : game.rating2Before;
      const after = seat === 1 ? game.rating1After : game.rating2After;
      record.rating -= after - before;
      if (game.winner === seat) record.wins = Math.max(0, record.wins - 1);
      else record.losses = Math.max(0, record.losses - 1);
    }
  }
  for (const [id, record] of out) {
    if (record.wins + record.losses === 0) out.set(id, { ...FRESH_PLAYER });
  }
  return out;
}
