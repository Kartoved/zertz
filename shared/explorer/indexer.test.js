import { describe, it, expect } from 'vitest';
import { indexGameTree } from './indexer.js';
import { hashPosition } from './hash.js';
import { canonicalizeState } from './canonicalize.js';
import { createInitialState, normalizePhase } from './replay.js';

// Build a tiny game tree by hand. Each node has children = [next-on-mainline]
// matching the runtime shape (parent links not needed for indexer).
function makeTree(moves) {
  const root = { id: 'root', moveNumber: 0, move: null, children: [] };
  let prev = root;
  let n = 1;
  for (const m of moves) {
    const node = { id: `n${n}`, moveNumber: n, move: m, children: [] };
    prev.children.push(node);
    prev = node;
    n++;
  }
  return root;
}

describe('indexGameTree', () => {
  it('first entry is the initial-state hash regardless of board size', () => {
    const tree = makeTree([
      { type: 'placement', data: { marbleColor: 'white', ringId: '0,0', removedRingId: '3,0' } },
    ]);
    const entries = indexGameTree(tree, 37);
    expect(entries.length).toBe(1);

    const initial = createInitialState(37);
    normalizePhase(initial);
    const initialHash = hashPosition(canonicalizeState(initial).canonicalString);
    expect(entries[0].positionHash).toBe(initialHash);
    expect(entries[0].ply).toBe(1);
    expect(entries[0].boardSize).toBe(37);
  });

  it('produces one entry per main-line move', () => {
    const tree = makeTree([
      { type: 'placement', data: { marbleColor: 'white', ringId: '0,0', removedRingId: '3,0' } },
      { type: 'placement', data: { marbleColor: 'gray',  ringId: '1,1', removedRingId: '-1,3' } },
      { type: 'placement', data: { marbleColor: 'black', ringId: '2,2', removedRingId: '-2,3' } },
    ]);
    const entries = indexGameTree(tree, 37);
    expect(entries.length).toBe(3);
    expect(entries.map(e => e.ply)).toEqual([1, 2, 3]);
  });

  it('produces algebraic-style notation for the canonical move', () => {
    const tree = makeTree([
      { type: 'placement', data: { marbleColor: 'white', ringId: '0,0', removedRingId: '3,0' } },
    ]);
    const entries = indexGameTree(tree, 37);
    expect(entries[0].moveNotation).toMatch(/^W[a-g]\d/);
  });

  it('canonical hash is identical for two games that played transformed-equivalent first moves', () => {
    // First game: play at (0,0) — corner of 37 board
    const tree1 = makeTree([
      { type: 'placement', data: { marbleColor: 'white', ringId: '0,0', removedRingId: '3,0' } },
    ]);
    // Second game: play at (3,0) — same canonical position (just rotated)
    const tree2 = makeTree([
      { type: 'placement', data: { marbleColor: 'white', ringId: '3,0', removedRingId: '0,0' } },
    ]);
    const e1 = indexGameTree(tree1, 37);
    const e2 = indexGameTree(tree2, 37);
    // Initial-position hash always matches.
    expect(e1[0].positionHash).toBe(e2[0].positionHash);
    // The canonical move notation should match too — both played the same
    // tactical move under a different orientation.
    expect(e1[0].moveNotation).toBe(e2[0].moveNotation);
  });

  it('returns empty for a tree with no moves played', () => {
    const tree = makeTree([]);
    expect(indexGameTree(tree, 37)).toEqual([]);
  });
});
