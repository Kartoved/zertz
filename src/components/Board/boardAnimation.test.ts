import { describe, it, expect } from 'vitest';
import { diffBoards, snapshotBoard, HOP_MS, type BoardSnap } from './boardAnimation';
import { createInitialState, cloneState } from '../../game/GameEngine';
import type { GameState, MarbleColor } from '../../game/types';

function put(s: GameState, id: string, color: MarbleColor | null) {
  s.rings.get(id)!.marble = color ? { color } : null;
}
const snap = (s: GameState): BoardSnap => snapshotBoard(s);

describe('diffBoards', () => {
  const base = createInitialState(37);
  const ids = [...base.rings.keys()];
  // pick three collinear ring ids along the q axis: (0,0) (1,0) (2,0)
  const A = '0,0', M = '1,0', B = '2,0';

  it('pops a placed marble and fades a removed ring', () => {
    const next = cloneState(base);
    put(next, A, 'white');
    next.rings.get(ids[ids.length - 1])!.isRemoved = true;
    const anim = diffBoards(snap(base), snap(next), null)!;
    expect(anim.dest).toEqual({ id: A, kind: 'pop', delayMs: 0 });
    expect(anim.vanishRings.map(r => r.id)).toEqual([ids[ids.length - 1]]);
  });

  it('flies a capturing marble along the hint path and fades the captured one', () => {
    const prev = cloneState(base);
    put(prev, A, 'black'); put(prev, M, 'gray');
    const next = cloneState(prev);
    put(next, A, null); put(next, M, null); put(next, B, 'black');
    const anim = diffBoards(snap(prev), snap(next), [A, B])!;
    expect(anim.flight).toEqual({ color: 'black', path: [A, B], hopMs: HOP_MS });
    expect(anim.dest).toEqual({ id: B, kind: 'appear', delayMs: HOP_MS });
    expect(anim.vanishMarbles).toEqual([{ id: M, color: 'gray', delayMs: HOP_MS / 2 }]);
  });

  it('skips backwards changes and multi-move jumps', () => {
    const next = cloneState(base);
    put(next, A, 'white');
    expect(diffBoards(snap(next), snap(base), null)).toBeNull(); // un-placing
    const two = cloneState(base);
    put(two, A, 'white'); put(two, B, 'gray');
    expect(diffBoards(snap(base), snap(two), null)).toBeNull();
    expect(diffBoards(snap(base), snap(base), null)).toBeNull();
  });

  it('does not guess a move without a path', () => {
    const prev = cloneState(base);
    put(prev, A, 'black'); put(prev, M, 'gray');
    const next = cloneState(prev);
    put(next, A, null); put(next, M, null); put(next, B, 'black');
    expect(diffBoards(snap(prev), snap(next), null)).toBeNull();
  });
});
