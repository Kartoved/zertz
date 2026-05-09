/**
 * Cross-engine parity test.
 *
 * The opening explorer's correctness depends on the shared replay engine
 * (shared/explorer/replay.js, plain JS) producing IDENTICAL state to the
 * production game engine (src/game/GameEngine.ts, TypeScript). Any silent
 * drift between them — a fix landed on one side but not the other — would
 * silently corrupt position hashes, so explorer lookups would miss
 * matching games even though they're tactically equivalent.
 *
 * This test is the guardrail for that drift: it replays the same Move
 * sequences through both engines and asserts the resulting states match
 * field-by-field.
 *
 * If this test breaks because of an intentional engine change, MIRROR THE
 * CHANGE into shared/explorer/replay.js. Both implementations must move
 * together.
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialState as createTsState,
  placeMarble as tsPlaceMarble,
  removeRing as tsRemoveRing,
  skipRingRemoval as tsSkipRingRemoval,
  executeCapture as tsExecuteCapture,
} from '../../src/game/GameEngine';
import {
  createInitialState as createJsState,
  applyMove as jsApplyMove,
} from './replay.js';
import type { GameState, Move } from '../../src/game/types';

// Mirror of shared/explorer/replay.js applyMove implemented on top of the TS
// engine primitives. Used to drive both engines from the same Move list.
function tsApplyMove(state: GameState, move: Move): void {
  if (move.type === 'placement') {
    tsPlaceMarble(state, move.data.ringId, move.data.marbleColor);
    if (move.data.removedRingId) {
      tsRemoveRing(state, move.data.removedRingId);
    } else {
      tsSkipRingRemoval(state);
    }
  } else if (move.type === 'capture') {
    const captures = [move.data, ...(move.data.chain || [])];
    tsExecuteCapture(state, captures);
  }
}

// Convert either engine's state into a deeply-comparable plain object.
// Maps are sorted by key so vitest's `toEqual` doesn't trip over iteration
// order differences.
function toComparable(state: any) {
  return {
    boardSize: state.boardSize,
    currentPlayer: state.currentPlayer,
    phase: state.phase,
    moveNumber: state.moveNumber,
    pendingPlacement: state.pendingPlacement,
    winner: state.winner,
    reserve: { ...state.reserve },
    captures: {
      player1: { ...state.captures.player1 },
      player2: { ...state.captures.player2 },
    },
    rings: Array.from(state.rings.entries() as Iterable<[string, any]>)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([id, r]) => ({
        id,
        marbleColor: r.marble ? r.marble.color : null,
        isRemoved: !!r.isRemoved,
      })),
  };
}

// Replay a sequence on both engines, asserting parity AFTER EACH move so
// drift surfaces at the move that introduced it.
function assertParity(boardSize: 37 | 48 | 61, moves: Move[]) {
  const tsState = createTsState(boardSize);
  const jsState = createJsState(boardSize);
  expect(toComparable(jsState)).toEqual(toComparable(tsState));

  for (let i = 0; i < moves.length; i++) {
    tsApplyMove(tsState, moves[i]);
    jsApplyMove(jsState, moves[i]);
    expect(toComparable(jsState), `parity broke at move ${i + 1}`)
      .toEqual(toComparable(tsState));
  }
}

describe('cross-engine parity', () => {
  it('initial states match for 37, 48, and 61', () => {
    for (const size of [37, 48, 61] as const) {
      expect(toComparable(createJsState(size))).toEqual(toComparable(createTsState(size)));
    }
  });

  // Removal targets must be VALID under the TS engine's
  // getValidRemovableRings rule (≥2 adjacent free edges). Corner rings are
  // the safest choice — they always have 2+ off-board edges. Each move
  // removes a different corner so we don't trip over depleted symmetries.

  it('matches across a placement-only opening on 37', () => {
    assertParity(37, [
      // P1: place at center-ish, remove top-left corner.
      { type: 'placement', data: { marbleColor: 'white', ringId: '1,1', removedRingId: '0,0' } },
      // P2: place, remove top-right corner.
      { type: 'placement', data: { marbleColor: 'gray',  ringId: '1,2', removedRingId: '3,0' } },
      // P1: place, remove right corner.
      { type: 'placement', data: { marbleColor: 'black', ringId: '-1,2', removedRingId: '3,3' } },
      // P2: place, remove left corner.
      { type: 'placement', data: { marbleColor: 'white', ringId: '0,2', removedRingId: '-3,3' } },
    ]);
  });

  it('matches across a placement-only opening on 48 (asymmetric tournament board)', () => {
    assertParity(48, [
      { type: 'placement', data: { marbleColor: 'white', ringId: '1,2', removedRingId: '0,0' } },
      { type: 'placement', data: { marbleColor: 'gray',  ringId: '1,3', removedRingId: '3,0' } },
      { type: 'placement', data: { marbleColor: 'black', ringId: '-1,3', removedRingId: '3,3' } },
    ]);
  });

  it('matches across a placement-only opening on 61', () => {
    assertParity(61, [
      { type: 'placement', data: { marbleColor: 'white', ringId: '1,2', removedRingId: '0,0' } },
      { type: 'placement', data: { marbleColor: 'gray',  ringId: '1,3', removedRingId: '4,0' } },
      { type: 'placement', data: { marbleColor: 'black', ringId: '-1,4', removedRingId: '4,4' } },
    ]);
  });

  it('matches across a forced single-capture turn (placement creates capture line, then a capture move)', () => {
    assertParity(37, [
      // P1: white at (0,0), removes top-far corner (3,3) (edge ring).
      { type: 'placement', data: { marbleColor: 'white', ringId: '0,0', removedRingId: '3,3' } },
      // P2: gray at (1,0) — adjacent to white. Removes left-far corner.
      { type: 'placement', data: { marbleColor: 'gray', ringId: '1,0', removedRingId: '-3,3' } },
      // P1's forced capture: white(0,0) jumps over gray(1,0), lands at (2,0).
      { type: 'capture', data: {
          from: '0,0', to: '2,0', captured: '1,0',
          marbleColor: 'white', capturedColor: 'gray',
        } },
    ]);
  });

  it('matches across a deeper game with several captures intermixed', () => {
    // A longer scenario on 61 (more room), exercising both placement+
    // ringRemoval and capture chains across many moves.
    assertParity(61, [
      { type: 'placement', data: { marbleColor: 'white', ringId: '0,0', removedRingId: '4,4' } },
      { type: 'placement', data: { marbleColor: 'gray',  ringId: '1,0', removedRingId: '-4,4' } },
      // P1 captures white(0,0)×gray(1,0) → lands at (2,0).
      { type: 'capture', data: {
          from: '0,0', to: '2,0', captured: '1,0',
          marbleColor: 'white', capturedColor: 'gray',
        } },
      // P2: place at (3,1), remove top corner (4,0).
      { type: 'placement', data: { marbleColor: 'gray', ringId: '3,1', removedRingId: '4,0' } },
      // P1: place at (1,2), remove (-4,8).
      { type: 'placement', data: { marbleColor: 'white', ringId: '1,2', removedRingId: '-4,8' } },
    ]);
  });
});
