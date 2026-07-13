import { describe, it, expect } from 'vitest';
import { parsePremoves, selectPremoveResponse } from './premoveTree.js';

function place(ringId, color = 'white') {
  return { type: 'placement', data: { marbleColor: color, ringId, removedRingId: null } };
}

// opponent node helper (children = my single reply, or [])
function oppNode(id, move, children = []) {
  return {
    id, move, notation: id, player: 'player2',
    newStateJson: `after-${id}`, newCurrentPlayer: 1, newWinner: null, newWinType: null,
    children,
  };
}
function myNode(id, move, children = []) {
  return {
    id, move, notation: id, player: 'player1',
    newStateJson: `after-${id}`, newCurrentPlayer: 2, newWinner: null, newWinType: null,
    children,
  };
}

describe('selectPremoveResponse', () => {
  const mvA = place('a1');
  const mvB = place('b1');
  const mvR = place('r1', 'gray');
  const mvD = place('d1');
  const mvE = place('e1');

  // Root has two opponent branches (A, B). Under A: my reply R, which itself
  // branches on two deeper opponent moves (D, E).
  const tree = {
    anchorStateJson: 'anchor',
    children: [
      oppNode('A', mvA, [myNode('R', mvR, [oppNode('D', mvD), oppNode('E', mvE)])]),
      oppNode('B', mvB, [myNode('S', place('s1'))]),
    ],
  };

  it('returns none for empty/null trees', () => {
    expect(selectPremoveResponse(null, mvA).action).toBe('none');
    expect(selectPremoveResponse({ children: [] }, mvA).action).toBe('none');
  });

  it('prunes when the opponent went off every branch', () => {
    const res = selectPremoveResponse(tree, place('z9'));
    expect(res.action).toBe('prune');
    expect(res.reason).toBe('no-branch-for-opponent-move');
  });

  it('ends quietly when the matched branch has no queued reply', () => {
    const t = { anchorStateJson: 'x', children: [oppNode('A', mvA, [])] };
    expect(selectPremoveResponse(t, mvA).action).toBe('end');
  });

  it('fires the reply and shifts the tree to the reply subtree, dropping siblings', () => {
    const res = selectPremoveResponse(tree, mvA);
    expect(res.action).toBe('fire');
    expect(res.response.id).toBe('R');
    // expectedPreStateJson = state after the opponent's move (from which R plays)
    expect(res.expectedPreStateJson).toBe('after-A');
    // New root = R's subtree: deeper branches D & E preserved…
    expect(res.newTree.children.map(c => c.id)).toEqual(['D', 'E']);
    expect(res.newTree.anchorStateJson).toBe('after-R');
    // …and sibling branch B is gone.
    const ids = JSON.stringify(res.newTree).includes('"B"');
    expect(ids).toBe(false);
  });

  it('newTree is null when the reply has no deeper branches', () => {
    const res = selectPremoveResponse(tree, mvB);
    expect(res.action).toBe('fire');
    expect(res.response.id).toBe('S');
    expect(res.newTree).toBeNull();
  });
});

describe('parsePremoves', () => {
  it('returns empty for junk', () => {
    expect(parsePremoves('not json')).toEqual({ player1: null, player2: null, notices: {} });
    expect(parsePremoves('{}')).toEqual({ player1: null, player2: null, notices: {} });
  });

  it('passes through the tree form', () => {
    const tree = { anchorStateJson: 'x', children: [oppNode('A', place('a1'))] };
    const parsed = parsePremoves(JSON.stringify({ player1: tree, player2: null }));
    expect(parsed.player1.children[0].id).toBe('A');
    expect(parsed.player2).toBeNull();
  });

  it('migrates the legacy array-of-variants form into a tree', () => {
    const step = (id, move, player) => ({
      move, notation: id, player,
      newStateJson: `after-${id}`, newCurrentPlayer: 1, newWinner: null, newWinType: null,
    });
    const legacy = {
      player1: [
        { id: 'v1', sequence: [step('A', place('a1'), 'player2'), step('R', place('r1'), 'player1')] },
      ],
    };
    const parsed = parsePremoves(JSON.stringify(legacy));
    expect(parsed.player1.children).toHaveLength(1);
    expect(parsed.player1.children[0].notation).toBe('A');
    expect(parsed.player1.children[0].children[0].notation).toBe('R');
  });

  it('prefix-merges legacy variants that share an opening move', () => {
    const step = (id, move, player) => ({
      move, notation: id, player,
      newStateJson: `after-${id}`, newCurrentPlayer: 1, newWinner: null, newWinType: null,
    });
    const legacy = {
      player2: [
        { id: 'v1', sequence: [step('A', place('a1'), 'player1'), step('R', place('r1'), 'player2')] },
        { id: 'v2', sequence: [step('A', place('a1'), 'player1'), step('S', place('s1'), 'player2')] },
      ],
    };
    const parsed = parsePremoves(JSON.stringify(legacy));
    // Shared opening A collapses; two distinct replies branch under it.
    expect(parsed.player2.children).toHaveLength(1);
    expect(parsed.player2.children[0].children.map(c => c.notation).sort()).toEqual(['R', 'S']);
  });
});
