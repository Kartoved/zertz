/**
 * Pure arena helpers — no DB, no side effects — so the pairing and scoring rules
 * (the parts most worth testing) are covered by unit tests. The stateful engine
 * (arenaEngine.js) calls these and persists the results.
 */

// Scoring constants (Lichess-style arena).
export const ARENA_WIN_POINTS = 2;
// When your streak BEFORE a win is already this high, the win is doubled ("on fire").
export const ARENA_STREAK_DOUBLE_AT = 2;
export const ARENA_BERSERK_BONUS = 1;
// Berserk's +1 only counts if the game actually got played this many half-moves,
// so an instant no-move flag/resign can't farm the bonus. state.moveNumber starts
// at 1 and increments per move, so >= 3 means both players made at least one move.
export const ARENA_BERSERK_MIN_MOVES = 3;

/**
 * Compute the score/streak outcome of one finished arena game. Pure.
 *
 * @param {object} g
 * @param {number|null} g.winnerUserId  winner's user id, or null (cancelled / no winner)
 * @param {number} g.user1Id
 * @param {number} g.user2Id
 * @param {number} g.p1Streak  player1's streak BEFORE this game
 * @param {number} g.p2Streak
 * @param {boolean} g.p1Berserk
 * @param {boolean} g.p2Berserk
 * @param {number} g.moveNumber  final state.moveNumber (gates the berserk bonus)
 * @returns {{p1: {scoreDelta:number, newStreak:number, played:boolean},
 *            p2: {scoreDelta:number, newStreak:number, played:boolean}}}
 */
export function applyGameResult(g) {
  const { winnerUserId, user1Id, user2Id, p1Streak, p2Streak, p1Berserk, p2Berserk, moveNumber } = g;

  // Cancelled / no winner: no score, streaks preserved, game not counted.
  if (winnerUserId == null) {
    return {
      p1: { scoreDelta: 0, newStreak: p1Streak, played: false },
      p2: { scoreDelta: 0, newStreak: p2Streak, played: false },
    };
  }

  const winnerIsP1 = winnerUserId === user1Id;
  const winnerStreakBefore = winnerIsP1 ? p1Streak : p2Streak;
  const winnerBerserk = winnerIsP1 ? p1Berserk : p2Berserk;

  let winPoints = winnerStreakBefore >= ARENA_STREAK_DOUBLE_AT ? ARENA_WIN_POINTS * 2 : ARENA_WIN_POINTS;
  if (winnerBerserk && moveNumber >= ARENA_BERSERK_MIN_MOVES) winPoints += ARENA_BERSERK_BONUS;

  const winner = { scoreDelta: winPoints, newStreak: winnerStreakBefore + 1, played: true };
  const loser = { scoreDelta: 0, newStreak: 0, played: true };

  return winnerIsP1 ? { p1: winner, p2: loser } : { p1: loser, p2: winner };
}

/**
 * Next occurrence (epoch ms, UTC) of a recurring schedule strictly after
 * `afterMs`. Recurrence is a UTC weekday + minute-of-day, so this is DST-free.
 * Pure.
 *
 * @param {{freq: 'daily'|'weekly', utcMinute: number, utcWeekday?: number}} rule
 * @param {number} afterMs
 * @returns {number} epoch ms of the next occurrence
 */
export function nextOccurrence(rule, afterMs) {
  const { freq, utcMinute } = rule;
  const h = Math.floor(utcMinute / 60);
  const m = utcMinute % 60;
  const a = new Date(afterMs);
  const y = a.getUTCFullYear();
  const mo = a.getUTCMonth();
  const d = a.getUTCDate();
  // Walk forward day-by-day (handles month/year rollover via Date.UTC) and take
  // the first candidate strictly after `afterMs` that matches the frequency.
  for (let i = 0; i <= 14; i++) {
    const cand = Date.UTC(y, mo, d + i, h, m, 0, 0);
    if (cand <= afterMs) continue;
    if (freq === 'weekly' && new Date(cand).getUTCDay() !== rule.utcWeekday) continue;
    return cand;
  }
  // Unreachable for valid rules (a match always exists within 14 days).
  return Date.UTC(y, mo, d + 7, h, m, 0, 0);
}

/**
 * Greedy Arena pairing. Sorts free players by score (then rating, then id for
 * determinism) and pairs neighbours, best-effort avoiding an immediate rematch.
 * An odd player out is left unpaired (picked up next tick). Pure.
 *
 * @param {Array<{userId:number, score:number, rating:number}>} players
 * @param {Record<number, number>} recentOpponents  userId → their last opponent's userId
 * @returns {Array<{a: object, b: object}>}
 */
export function buildPairings(players, recentOpponents = {}) {
  const sorted = [...players].sort(
    (x, y) => (y.score - x.score) || (y.rating - x.rating) || (x.userId - y.userId)
  );
  const used = new Set();
  const pairs = [];

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    if (used.has(a.userId)) continue;

    // Find the nearest unused partner; prefer one who isn't a's last opponent,
    // but fall back to the nearest if a rematch is unavoidable.
    let partnerIdx = -1;
    let fallbackIdx = -1;
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (used.has(b.userId)) continue;
      if (fallbackIdx === -1) fallbackIdx = j;
      if (recentOpponents[a.userId] !== b.userId) { partnerIdx = j; break; }
    }
    const chosen = partnerIdx !== -1 ? partnerIdx : fallbackIdx;
    if (chosen === -1) break; // nobody left to pair with a

    used.add(a.userId);
    used.add(sorted[chosen].userId);
    pairs.push({ a, b: sorted[chosen] });
  }

  return pairs;
}
