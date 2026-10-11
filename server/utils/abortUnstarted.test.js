import { describe, it, expect } from 'vitest';
import { FRESH_PLAYER, isUnstartedTimeLoss, refundRatings } from './abortUnstarted.js';

// A main line of placements by the given players, as stored in tree_json.
function tree(players, { withPlayer = true } = {}) {
  const root = { id: 'root', move: null, children: [] };
  let parent = root;
  players.forEach((player, i) => {
    const node = {
      id: `n${i}`,
      move: { type: 'placement', data: { marbleColor: 'white', ringId: `${i},3`, removedRingId: null } },
      children: [],
      ...(withPlayer ? { player } : {}),
    };
    parent.children.push(node);
    parent = node;
  });
  return JSON.stringify(root);
}

describe('isUnstartedTimeLoss', () => {
  it('white flagged before moving at all', () => {
    expect(isUnstartedTimeLoss({ winner: 2, winType: 'time', treeJson: tree([]) })).toBe(true);
  });

  it('black flagged before its first move', () => {
    expect(isUnstartedTimeLoss({ winner: 1, winType: 'time', treeJson: tree(['player1']) })).toBe(true);
  });

  it("black's first move arrived after its clock had run out", () => {
    expect(isUnstartedTimeLoss({ winner: 1, winType: 'time', treeJson: tree(['player1', 'player2']) })).toBe(true);
  });

  it('a real loss on time once both sides have moved', () => {
    expect(isUnstartedTimeLoss({ winner: 2, winType: 'time', treeJson: tree(['player1', 'player2']) })).toBe(false);
    expect(isUnstartedTimeLoss({ winner: 1, winType: 'time', treeJson: tree(['player1', 'player2', 'player1']) })).toBe(false);
  });

  it('only losses on time — a resignation before the first move stands', () => {
    expect(isUnstartedTimeLoss({ winner: 2, winType: 'surrender', treeJson: tree([]) })).toBe(false);
    expect(isUnstartedTimeLoss({ winner: 0, winType: 'aborted', treeJson: tree([]) })).toBe(false);
  });

  it('places old nodes without a player by alternation from the setup', () => {
    // A custom start where Black moves first; Black moved, White flagged.
    const setupJson = JSON.stringify({ currentPlayer: 'player2' });
    const treeJson = tree(['player2'], { withPlayer: false });
    expect(isUnstartedTimeLoss({ winner: 2, winType: 'time', treeJson, setupJson })).toBe(true);
    expect(isUnstartedTimeLoss({ winner: 1, winType: 'time', treeJson, setupJson })).toBe(true);
    expect(isUnstartedTimeLoss({ winner: 1, winType: 'time', treeJson: tree(['player2', 'player1', 'player2'], { withPlayer: false }), setupJson }))
      .toBe(false);
  });
});

describe('refundRatings', () => {
  const record = (rating, wins, losses) => ({ rating, rd: 120, vol: 0.06, wins, losses, currentStreak: 2, bestStreak: 3 });

  it('gives each player back what the game moved them by and strikes the result', () => {
    const users = new Map([[1, record(1612, 5, 3)], [2, record(1480, 4, 6)]]);
    const out = refundRatings([
      { user1Id: 1, user2Id: 2, winner: 1, rating1Before: 1590, rating1After: 1612, rating2Before: 1502, rating2After: 1480 },
    ], users);
    expect(out.get(1)).toEqual({ ...record(1590, 4, 3) });
    expect(out.get(2)).toEqual({ ...record(1502, 4, 5) });
  });

  it('adds up several refunds for the same player', () => {
    const users = new Map([[1, record(1400, 1, 3)], [2, record(1600, 2, 0)], [3, record(1550, 2, 1)]]);
    const out = refundRatings([
      { user1Id: 1, user2Id: 2, winner: 2, rating1Before: 1450, rating1After: 1430, rating2Before: 1580, rating2After: 1600 },
      { user1Id: 3, user2Id: 1, winner: 1, rating1Before: 1530, rating1After: 1550, rating2Before: 1430, rating2After: 1400 },
    ], users);
    expect(out.get(1)).toMatchObject({ rating: 1450, wins: 1, losses: 1 });
    expect(out.get(2)).toMatchObject({ rating: 1580, wins: 1, losses: 0 });
    expect(out.get(3)).toMatchObject({ rating: 1530, wins: 1, losses: 1 });
  });

  it('resets a player whose only rated games are refunded to a fresh record', () => {
    const users = new Map([[1, record(1338, 0, 1)], [2, record(1662, 1, 0)]]);
    const out = refundRatings([
      { user1Id: 1, user2Id: 2, winner: 2, rating1Before: 1500, rating1After: 1338, rating2Before: 1500, rating2After: 1662 },
    ], users);
    expect(out.get(1)).toEqual(FRESH_PLAYER);
    expect(out.get(2)).toEqual(FRESH_PLAYER);
  });
});
