import { describe, it, expect } from 'vitest';
import { applyGameResult, buildPairings, nextOccurrence } from './arena.js';

const base = {
  user1Id: 1, user2Id: 2,
  p1Streak: 0, p2Streak: 0,
  p1Berserk: false, p2Berserk: false,
  moveNumber: 10,
};

describe('applyGameResult', () => {
  it('awards 2 for a plain win and resets the loser streak', () => {
    const r = applyGameResult({ ...base, winnerUserId: 1 });
    expect(r.p1).toEqual({ scoreDelta: 2, newStreak: 1, played: true });
    expect(r.p2).toEqual({ scoreDelta: 0, newStreak: 0, played: true });
  });

  it('doubles the win to 4 when the winner is on fire (streak >= 2)', () => {
    const r = applyGameResult({ ...base, winnerUserId: 1, p1Streak: 2 });
    expect(r.p1.scoreDelta).toBe(4);
    expect(r.p1.newStreak).toBe(3);
  });

  it('does NOT double at streak 1 (below the threshold)', () => {
    const r = applyGameResult({ ...base, winnerUserId: 1, p1Streak: 1 });
    expect(r.p1.scoreDelta).toBe(2);
    expect(r.p1.newStreak).toBe(2);
  });

  it('adds the berserk bonus (+1) for a berserked win past the min moves', () => {
    const r = applyGameResult({ ...base, winnerUserId: 1, p1Berserk: true, moveNumber: 3 });
    expect(r.p1.scoreDelta).toBe(3);
  });

  it('stacks berserk with the streak double (4 + 1 = 5)', () => {
    const r = applyGameResult({ ...base, winnerUserId: 1, p1Streak: 2, p1Berserk: true, moveNumber: 5 });
    expect(r.p1.scoreDelta).toBe(5);
  });

  it('ignores the berserk bonus if the game was too short', () => {
    const r = applyGameResult({ ...base, winnerUserId: 1, p1Berserk: true, moveNumber: 2 });
    expect(r.p1.scoreDelta).toBe(2);
  });

  it('does not credit the loser for berserking', () => {
    const r = applyGameResult({ ...base, winnerUserId: 1, p2Berserk: true, moveNumber: 20 });
    expect(r.p2.scoreDelta).toBe(0);
  });

  it('handles a player2 win symmetrically', () => {
    const r = applyGameResult({ ...base, winnerUserId: 2, p2Streak: 2 });
    expect(r.p2).toEqual({ scoreDelta: 4, newStreak: 3, played: true });
    expect(r.p1).toEqual({ scoreDelta: 0, newStreak: 0, played: true });
  });

  it('scores nothing and preserves streaks for a cancelled game', () => {
    const r = applyGameResult({ ...base, winnerUserId: null, p1Streak: 3, p2Streak: 1 });
    expect(r.p1).toEqual({ scoreDelta: 0, newStreak: 3, played: false });
    expect(r.p2).toEqual({ scoreDelta: 0, newStreak: 1, played: false });
  });
});

const P = (userId, score, rating) => ({ userId, score, rating });

describe('buildPairings', () => {
  it('pairs two players', () => {
    const pairs = buildPairings([P(1, 0, 1500), P(2, 0, 1500)]);
    expect(pairs).toHaveLength(1);
    expect(new Set([pairs[0].a.userId, pairs[0].b.userId])).toEqual(new Set([1, 2]));
  });

  it('returns no pairs for fewer than two players', () => {
    expect(buildPairings([])).toEqual([]);
    expect(buildPairings([P(1, 0, 1500)])).toEqual([]);
  });

  it('leaves the lowest-scoring player unpaired when the count is odd', () => {
    const pairs = buildPairings([P(1, 6, 1500), P(2, 4, 1500), P(3, 0, 1500)]);
    expect(pairs).toHaveLength(1);
    const paired = new Set([pairs[0].a.userId, pairs[0].b.userId]);
    expect(paired).toEqual(new Set([1, 2])); // top two paired; #3 waits
  });

  it('pairs neighbours by score', () => {
    const pairs = buildPairings([P(1, 10, 1500), P(2, 8, 1500), P(3, 2, 1500), P(4, 0, 1500)]);
    expect(pairs).toHaveLength(2);
    expect(new Set([pairs[0].a.userId, pairs[0].b.userId])).toEqual(new Set([1, 2]));
    expect(new Set([pairs[1].a.userId, pairs[1].b.userId])).toEqual(new Set([3, 4]));
  });

  it('avoids an immediate rematch when an alternative exists', () => {
    // 1 & 2 have equal score and just played each other; a non-rematch pairing exists.
    const players = [P(1, 4, 1600), P(2, 4, 1500), P(3, 4, 1400), P(4, 4, 1300)];
    const recent = { 1: 2, 2: 1 };
    const pairs = buildPairings(players, recent);
    expect(pairs).toHaveLength(2);
    // player 1 must NOT be paired with player 2 again
    const p1pair = pairs.find(p => p.a.userId === 1 || p.b.userId === 1);
    const p1opp = p1pair.a.userId === 1 ? p1pair.b.userId : p1pair.a.userId;
    expect(p1opp).not.toBe(2);
  });

  it('falls back to a rematch when no alternative exists', () => {
    const pairs = buildPairings([P(1, 4, 1500), P(2, 4, 1500)], { 1: 2, 2: 1 });
    expect(pairs).toHaveLength(1); // only option is the rematch
  });
});

function toSunday(ms) {
  let t = ms;
  while (new Date(t).getUTCDay() !== 0) t += 24 * 3600 * 1000;
  return t;
}

describe('nextOccurrence', () => {
  it('daily: returns today at the time when still upcoming', () => {
    const after = Date.UTC(2026, 0, 1, 9, 0);
    expect(nextOccurrence({ freq: 'daily', utcMinute: 600 }, after)).toBe(Date.UTC(2026, 0, 1, 10, 0));
  });

  it('daily: rolls to tomorrow once the time has passed', () => {
    const after = Date.UTC(2026, 0, 1, 11, 0);
    expect(nextOccurrence({ freq: 'daily', utcMinute: 600 }, after)).toBe(Date.UTC(2026, 0, 2, 10, 0));
  });

  it('weekly: lands on the right UTC weekday + time in the coming week', () => {
    const after = Date.UTC(2026, 0, 1, 9, 0);
    const r = nextOccurrence({ freq: 'weekly', utcWeekday: 0, utcMinute: 750 }, after);
    const d = new Date(r);
    expect(d.getUTCDay()).toBe(0);
    expect(d.getUTCHours()).toBe(12);
    expect(d.getUTCMinutes()).toBe(30);
    expect(r).toBeGreaterThan(after);
    expect(r - after).toBeLessThanOrEqual(7 * 24 * 3600 * 1000);
  });

  it('weekly: same weekday but time already passed -> next week', () => {
    const sundayAfternoon = toSunday(Date.UTC(2026, 0, 4, 13, 0));
    const r = nextOccurrence({ freq: 'weekly', utcWeekday: 0, utcMinute: 750 }, sundayAfternoon);
    expect(new Date(r).getUTCDay()).toBe(0);
    expect(r - sundayAfternoon).toBeGreaterThan(6 * 24 * 3600 * 1000);
  });

  it('weekly: same weekday, time still upcoming -> same day', () => {
    const sundayMorning = toSunday(Date.UTC(2026, 0, 4, 9, 0));
    const d0 = new Date(sundayMorning);
    const expected = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), d0.getUTCDate(), 12, 30);
    expect(nextOccurrence({ freq: 'weekly', utcWeekday: 0, utcMinute: 750 }, sundayMorning)).toBe(expected);
  });
});
