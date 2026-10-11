import { describe, it, expect } from 'vitest';
import { createRootNode, promoteToMainLine, moveVariationUp, truncateAfter, isOnMainLine } from './gameTreeUtils';
import type { GameNode } from '../game/types';

function child(parent: GameNode, id: string): GameNode {
  const n: GameNode = { id, moveNumber: parent.moveNumber + 1, player: 'player1', move: null, notation: id, children: [], parent, isMainLine: parent.children.length === 0 };
  parent.children.push(n);
  return n;
}

describe('variation editing', () => {
  it('promotes a nested variation to the main line up to the root', () => {
    const root = createRootNode();
    const a = child(root, 'a'); const b = child(root, 'b');
    child(b, 'b1'); const b2 = child(b, 'b2');
    expect(isOnMainLine(b2)).toBe(false);
    promoteToMainLine(b2);
    expect(root.children[0]).toBe(b);
    expect(b.children[0]).toBe(b2);
    expect(b2.isMainLine && b.isMainLine && !a.isMainLine).toBe(true);
    expect(isOnMainLine(b2)).toBe(true);
  });

  it('moves a variation up one place', () => {
    const root = createRootNode();
    child(root, 'a'); child(root, 'b'); const c = child(root, 'c');
    moveVariationUp(c);
    expect(root.children.map(n => n.id)).toEqual(['a', 'c', 'b']);
    moveVariationUp(c);
    expect(root.children.map(n => n.id)).toEqual(['c', 'a', 'b']);
    expect(c.isMainLine).toBe(true);
    moveVariationUp(c); // already first: no-op
    expect(root.children[0]).toBe(c);
  });

  it('truncates the continuation', () => {
    const root = createRootNode();
    const a = child(root, 'a'); child(a, 'a1');
    truncateAfter(a);
    expect(a.children).toEqual([]);
  });
});
