import { describe, it, expect } from 'vitest';
import { cloneState, createInitialState, placeMarble } from '../game/GameEngine';
import { getValidRemovableRings } from '../game/Board';
import { GameState } from '../game/types';
import { applyCapture, applyPlacement, applyRingRemoval } from '../utils/moveActions';
import type { GameNode } from '../game/types';
import { applyBotMove, generateAllMoves, moveFromKey, moveKey, placeableColors } from './apply';
import { rng } from './arena';

// The slow, obviously-right enumeration: place on a copy, ask the engine.
function referencePlacements(state: GameState): string[] {
  const keys: string[] = [];
  for (const [ringId, ring] of state.rings) {
    if (ring.isRemoved || ring.marble) continue;
    for (const color of placeableColors(state)) {
      const s = cloneState(state);
      placeMarble(s, ringId, color);
      const removable = getValidRemovableRings(s.rings);
      if (removable.length === 0) keys.push(`${color[0].toUpperCase()}@${ringId}-`);
      for (const r of removable) keys.push(`${color[0].toUpperCase()}@${ringId}-${r}`);
    }
  }
  return keys.sort();
}

// Random positions on every board, reached through the bot path itself.
function positions(size: 37 | 48 | 61, count: number, seed: number): GameState[] {
  const rand = rng(seed);
  const out: GameState[] = [];
  let state = createInitialState(size);
  while (out.length < count) {
    const moves = generateAllMoves(state);
    if (moves.length === 0) { state = createInitialState(size); continue; }
    out.push(state);
    state = applyBotMove(state, moves[Math.floor(rand() * moves.length)]);
  }
  return out;
}

describe('generateAllMoves', () => {
  it('produces exactly the placements the engine allows, on every board', () => {
    for (const size of [37, 48, 61] as const) {
      for (const state of positions(size, 40, size)) {
        const moves = generateAllMoves(state);
        if (moves[0]?.type !== 'placement') continue;
        expect(moves.map(moveKey).sort(), `${size}`).toEqual(referencePlacements(state));
      }
    }
  });

  it('returns only captures when a capture exists', () => {
    for (const state of positions(48, 200, 7)) {
      const moves = generateAllMoves(state);
      const capturing = moves.some(m => m.type === 'capture');
      if (capturing) expect(moves.every(m => m.type === 'capture')).toBe(true);
    }
  });
});

describe('applyBotMove', () => {
  it('lands on the same position as the UI path', () => {
    for (const state of positions(48, 120, 11)) {
      for (const move of generateAllMoves(state).slice(0, 5)) {
        const ours = applyBotMove(state, move);
        let ui: GameState;
        if (move.type === 'capture') {
          ui = applyCapture(state, move.chain).newState;
        } else {
          const placed = applyPlacement(state, move.ringId, move.color)!;
          ui = placed.newState;
          if (placed.needsRingRemoval) {
            const node = { move: placed.move } as GameNode;
            ui = applyRingRemoval(ui, node, move.removedRingId!)!.newState;
          }
        }
        expect(JSON.stringify([...ours.rings.entries()])).toBe(JSON.stringify([...ui.rings.entries()]));
        expect(ours.captures).toEqual(ui.captures);
        expect(ours.reserve).toEqual(ui.reserve);
        expect(ours.currentPlayer).toBe(ui.currentPlayer);
        expect(ours.winner ?? null).toBe(ui.winner ?? null);
      }
    }
  });

  it('round-trips moves through their keys', () => {
    for (const state of positions(48, 60, 3)) {
      for (const move of generateAllMoves(state).slice(0, 3)) {
        expect(moveKey(moveFromKey(state, moveKey(move)))).toBe(moveKey(move));
      }
    }
  });
});
