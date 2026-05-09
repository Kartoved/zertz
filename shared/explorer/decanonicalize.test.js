/**
 * De-canonicalize round-trip and cross-frame consistency.
 *
 * The opening explorer's UI relies on:
 *   1. Round-trip: canonicalizeMove → decanonicalizeMove returns an
 *      equivalent move. For an asymmetric state, that's the same move.
 *   2. Cross-frame: any two equivalent (state, move) pairs — related by a
 *      board symmetry — yield the same canonical hash AND, when applied to
 *      their own user-frame state, produce the same canonical hash for
 *      the resulting state.
 *
 * Property (2) is what makes "click a move in the explorer" work: the
 * panel can be looking at a position arrived at via any orientation, but
 * applying the canonical move (de-canonicalized into the user's frame)
 * always lands on a position whose hash agrees with the server's view.
 */

import { describe, it, expect } from 'vitest';
import {
  canonicalizeState,
  canonicalizeMove,
  decanonicalizeMove,
} from './canonicalize.js';
import { hashPosition } from './hash.js';
import {
  createInitialState,
  cloneState,
  applyMove,
  normalizePhase,
} from './replay.js';
import { applyBoardTransform } from './axial.js';

// Apply transform `t` to every coord in a state's rings, producing a state
// that is the same canonical position viewed from a rotated/reflected
// orientation.
function transformState(state, t) {
  if (t === 0) return cloneState(state);
  const out = cloneState(state);
  const newRings = new Map();
  for (const ring of state.rings.values()) {
    const np = applyBoardTransform(ring.q, ring.r, state.boardSize, t);
    const newId = `${np.q},${np.r}`;
    newRings.set(newId, {
      id: newId,
      q: np.q,
      r: np.r,
      marble: ring.marble ? { ...ring.marble } : null,
      isRemoved: ring.isRemoved,
    });
  }
  out.rings = newRings;
  return out;
}

function transformId(id, t, size) {
  if (t === 0) return id;
  const [q, r] = id.split(',').map(Number);
  const out = applyBoardTransform(q, r, size, t);
  return `${out.q},${out.r}`;
}

function transformMove(move, t, size) {
  if (t === 0) return JSON.parse(JSON.stringify(move));
  if (move.type === 'placement') {
    return {
      type: 'placement',
      data: {
        ...move.data,
        ringId: transformId(move.data.ringId, t, size),
        removedRingId: move.data.removedRingId
          ? transformId(move.data.removedRingId, t, size)
          : null,
      },
    };
  }
  // capture
  const head = {
    ...move.data,
    from: transformId(move.data.from, t, size),
    to: transformId(move.data.to, t, size),
    captured: transformId(move.data.captured, t, size),
  };
  if (move.data.chain) {
    head.chain = move.data.chain.map(c => ({
      ...c,
      from: transformId(c.from, t, size),
      to: transformId(c.to, t, size),
      captured: transformId(c.captured, t, size),
    }));
  }
  return { type: 'capture', data: head };
}

// Build an asymmetric position by playing a couple of moves on an
// initially-symmetric board. After two distinct placements the state has
// trivial symmetry (only the identity transform is valid), so canonical
// indices are a singleton and round-trip is exact.
function asymmetricSetup() {
  const s = createInitialState(37);
  applyMove(s, {
    type: 'placement',
    data: { marbleColor: 'white', ringId: '1,1', removedRingId: '0,0' },
  });
  applyMove(s, {
    type: 'placement',
    data: { marbleColor: 'gray', ringId: '2,2', removedRingId: '3,0' },
  });
  normalizePhase(s);
  return s;
}

describe('decanonicalizeMove round-trip', () => {
  it('on an asymmetric state returns the original move byte-for-byte', () => {
    const state = asymmetricSetup();
    const move = {
      type: 'placement',
      data: { marbleColor: 'black', ringId: '0,2', removedRingId: '-3,3' },
    };
    const canon = canonicalizeState(state);
    expect(canon.transformIndices.length).toBe(1); // truly asymmetric

    const canonMove = canonicalizeMove(move, canon.transformIndices, state.boardSize);
    const restored = decanonicalizeMove(canonMove, canon.transformIndices, state.boardSize);
    expect(restored).toEqual(move);
  });

  it('handles a capture move: round-trip on an asymmetric state preserves chain coords', () => {
    const state = asymmetricSetup();
    const move = {
      type: 'capture',
      data: {
        from: '0,3', to: '2,3', captured: '1,3',
        marbleColor: 'white', capturedColor: 'gray',
        chain: [
          { from: '2,3', to: '2,5', captured: '2,4', marbleColor: 'white', capturedColor: 'black' },
        ],
      },
    };
    const canon = canonicalizeState(state);
    const canonMove = canonicalizeMove(move, canon.transformIndices, state.boardSize);
    const restored = decanonicalizeMove(canonMove, canon.transformIndices, state.boardSize);
    expect(restored).toEqual(move);
  });

  it('on a fully-symmetric state, round-trip lands on an EQUIVALENT move (not necessarily byte-identical)', () => {
    // Initial state has all 12 transforms tied — canonicalizeMove picks
    // the lex-smallest representative, which may not be the input. The
    // key property: applying the original and the round-tripped move to
    // the SAME state produces equivalent (canonically-equal) results.
    const state = createInitialState(37);
    const move = {
      type: 'placement',
      data: { marbleColor: 'white', ringId: '3,0', removedRingId: '0,0' },
    };
    const canon = canonicalizeState(state);
    expect(canon.transformIndices.length).toBeGreaterThan(1);

    const canonMove = canonicalizeMove(move, canon.transformIndices, state.boardSize);
    const restored = decanonicalizeMove(canonMove, canon.transformIndices, state.boardSize);

    // Apply each to a fresh clone and compare canonical hashes of the
    // resulting states.
    const sA = cloneState(state);
    applyMove(sA, move);
    normalizePhase(sA);
    const sB = cloneState(state);
    applyMove(sB, restored);
    normalizePhase(sB);

    const hashA = hashPosition(canonicalizeState(sA).canonicalString);
    const hashB = hashPosition(canonicalizeState(sB).canonicalString);
    expect(hashB).toBe(hashA);
  });
});

describe('cross-frame consistency (the explorer click-to-apply guarantee)', () => {
  it('two transformed-equivalent (state, move) pairs reach the same canonical post-state hash', () => {
    const state = asymmetricSetup();
    const move = {
      type: 'placement',
      data: { marbleColor: 'black', ringId: '0,2', removedRingId: '-3,3' },
    };

    // "Server side": canonicalize once, hash the resulting post-state.
    const sAfter = cloneState(state);
    applyMove(sAfter, move);
    normalizePhase(sAfter);
    const referenceHash = hashPosition(canonicalizeState(sAfter).canonicalString);

    // "Client side": for every board symmetry, view the SAME position
    // through a transformed lens and verify that the explorer-driven flow
    // (canonicalize → decanonicalize via the user's transformIndices →
    // apply) reaches an identical canonical post-state.
    for (let t = 0; t < 12; t++) {
      const userState = transformState(state, t);
      const userCanon = canonicalizeState(userState);
      const canonMove = canonicalizeMove(move, canonicalizeState(state).transformIndices, state.boardSize);
      const userMove = decanonicalizeMove(canonMove, userCanon.transformIndices, userState.boardSize);

      const userAfter = cloneState(userState);
      applyMove(userAfter, userMove);
      normalizePhase(userAfter);
      const userHash = hashPosition(canonicalizeState(userAfter).canonicalString);
      expect(userHash, `hash mismatch at transform ${t}`).toBe(referenceHash);
    }
  });

  it('client-side decanonicalize selects a valid move that the JS engine accepts', () => {
    // For each board symmetry, after de-canonicalizing the move into the
    // user's frame, applying it must succeed (no marble placed on a
    // removed ring, etc.) and the resulting state must canonicalize to
    // the same hash as the reference.
    const state = asymmetricSetup();
    const move = {
      type: 'placement',
      data: { marbleColor: 'black', ringId: '0,2', removedRingId: '-3,3' },
    };
    const refAfter = cloneState(state);
    applyMove(refAfter, move);
    normalizePhase(refAfter);
    const refHash = hashPosition(canonicalizeState(refAfter).canonicalString);

    for (let t = 0; t < 12; t++) {
      const userState = transformState(state, t);
      const userMove = decanonicalizeMove(
        canonicalizeMove(move, canonicalizeState(state).transformIndices, state.boardSize),
        canonicalizeState(userState).transformIndices,
        state.boardSize
      );
      // Sanity: target ring must exist and be empty in userState.
      const targetId = userMove.type === 'placement' ? userMove.data.ringId : userMove.data.from;
      const targetRing = userState.rings.get(targetId);
      expect(targetRing, `transform ${t}: target ring ${targetId} missing`).toBeDefined();

      const after = cloneState(userState);
      applyMove(after, userMove);
      normalizePhase(after);
      expect(hashPosition(canonicalizeState(after).canonicalString)).toBe(refHash);
    }
  });
});
