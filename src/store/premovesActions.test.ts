import '../test/localStorageShim';
import { describe, it, expect } from 'vitest';
import { mergePathIntoTree, removeBranch, PreMovePathStep } from './premovesActions';
import { Move, Player, PreMoveTree } from '../game/types';

function place(ringId: string, color: 'white' | 'gray' | 'black' = 'white'): Move {
  return { type: 'placement', data: { marbleColor: color, ringId, removedRingId: null } };
}

function step(notation: string, move: Move, player: Player): PreMovePathStep {
  return {
    move, notation, player,
    newStateJson: `after-${notation}`, newCurrentPlayer: 1, newWinner: null, newWinType: null,
  };
}

const OWNER: Player = 'player1';
const OPP: Player = 'player2';
const ANCHOR = 'anchor';

describe('mergePathIntoTree', () => {
  it('creates opponent branches from separate paths', () => {
    let tree: PreMoveTree | null = null;
    const r1 = mergePathIntoTree(tree, [step('A', place('a1'), OPP), step('R', place('r1'), OWNER)], ANCHOR, OWNER, false);
    expect(r1.ok).toBe(true);
    tree = (r1 as { ok: true; tree: PreMoveTree }).tree;

    const r2 = mergePathIntoTree(tree, [step('B', place('b1'), OPP), step('S', place('s1'), OWNER)], ANCHOR, OWNER, false);
    expect(r2.ok).toBe(true);
    tree = (r2 as { ok: true; tree: PreMoveTree }).tree;

    expect(tree.children.map(c => c.notation).sort()).toEqual(['A', 'B']);
    expect(tree.children.every(c => c.children.length === 1)).toBe(true);
  });

  it('branches deeper under my reply on the opponent level', () => {
    let tree: PreMoveTree | null = null;
    tree = (mergePathIntoTree(tree, [step('A', place('a1'), OPP), step('R', place('r1'), OWNER), step('D', place('d1'), OPP), step('X', place('x1'), OWNER)], ANCHOR, OWNER, false) as any).tree;
    tree = (mergePathIntoTree(tree, [step('A', place('a1'), OPP), step('R', place('r1'), OWNER), step('E', place('e1'), OPP), step('Y', place('y1'), OWNER)], ANCHOR, OWNER, false) as any).tree;

    // A → R → {D, E}
    const A = tree!.children[0];
    const R = A.children[0];
    expect(R.children.map(c => c.notation).sort()).toEqual(['D', 'E']);
  });

  it('reports a conflict when a different reply already exists for a position', () => {
    let tree: PreMoveTree | null =
      (mergePathIntoTree(null, [step('A', place('a1'), OPP), step('R', place('r1'), OWNER)], ANCHOR, OWNER, false) as any).tree;

    const conflict = mergePathIntoTree(tree, [step('A', place('a1'), OPP), step('S', place('s1'), OWNER)], ANCHOR, OWNER, false);
    expect(conflict.ok).toBe(false);
    expect((conflict as any).conflict.existingNotation).toBe('R');
    expect((conflict as any).conflict.newNotation).toBe('S');
  });

  it('overwrites the reply (and its subtree) when overwrite=true', () => {
    let tree: PreMoveTree | null =
      (mergePathIntoTree(null, [step('A', place('a1'), OPP), step('R', place('r1'), OWNER), step('D', place('d1'), OPP)], ANCHOR, OWNER, false) as any).tree;

    const res = mergePathIntoTree(tree, [step('A', place('a1'), OPP), step('S', place('s1'), OWNER)], ANCHOR, OWNER, true);
    expect(res.ok).toBe(true);
    const A = (res as any).tree.children[0];
    expect(A.children).toHaveLength(1);
    expect(A.children[0].notation).toBe('S');   // R replaced…
    expect(A.children[0].children).toHaveLength(0); // …and its deeper branch D dropped
  });

  it('starts a fresh tree when the anchor has moved on', () => {
    const tree: PreMoveTree =
      (mergePathIntoTree(null, [step('A', place('a1'), OPP), step('R', place('r1'), OWNER)], ANCHOR, OWNER, false) as any).tree;
    const res = mergePathIntoTree(tree, [step('B', place('b1'), OPP), step('S', place('s1'), OWNER)], 'different-anchor', OWNER, false);
    expect(res.ok).toBe(true);
    // Old anchor's branch A is gone; only the new one remains.
    expect((res as any).tree.children.map((c: any) => c.notation)).toEqual(['B']);
  });
});

describe('removeBranch', () => {
  it('removes a subtree by node id and returns null when emptied', () => {
    const tree: PreMoveTree =
      (mergePathIntoTree(null, [step('A', place('a1'), OPP), step('R', place('r1'), OWNER)], ANCHOR, OWNER, false) as any).tree;
    const aId = tree.children[0].id;
    expect(removeBranch(tree, aId)).toBeNull();
  });

  it('removes only the targeted branch, keeping siblings', () => {
    let tree: PreMoveTree | null =
      (mergePathIntoTree(null, [step('A', place('a1'), OPP), step('R', place('r1'), OWNER)], ANCHOR, OWNER, false) as any).tree;
    tree = (mergePathIntoTree(tree, [step('B', place('b1'), OPP), step('S', place('s1'), OWNER)], ANCHOR, OWNER, false) as any).tree;
    const bId = tree!.children.find(c => c.notation === 'B')!.id;
    const pruned = removeBranch(tree, bId);
    expect(pruned!.children.map(c => c.notation)).toEqual(['A']);
  });
});
