import { describe, it, expect } from 'vitest';
import { createInitialState, moveToNotation } from '../game/GameEngine';
import { MarbleColor } from '../game/types';
import { applyPlacement } from './moveActions';

describe('applyPlacement', () => {
  it('records the marbles claimed when a placement fills the board with no ring to remove', () => {
    const state = createInitialState(37);
    const keep: Record<string, MarbleColor | null> = { '0,3': 'white', '1,3': 'gray', '2,3': null };
    for (const [id, ring] of state.rings) {
      if (id in keep) ring.marble = keep[id] ? { color: keep[id]! } : null;
      else ring.isRemoved = true;
    }

    const result = applyPlacement(state, '2,3', 'black')!;

    expect(result.needsRingRemoval).toBe(false);
    expect(result.move.type === 'placement' && [...result.move.data.isolatedCaptures!].sort())
      .toEqual(['black', 'gray', 'white']);
    expect(moveToNotation(result.move, 37)).toMatch(/\+[wgb]{3}$/);
    expect(result.winner).toBe('player1');
    expect(result.winType).toBe('fullBoard');
    expect(result.newState.phase).toBe('gameOver');
  });
});
