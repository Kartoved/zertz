import { describe, it, expect } from 'vitest';
import { canonicalizeState, canonicalizeMove } from './canonicalize.js';
import { hashPosition } from './hash.js';
import { createInitialState, applyMove, normalizePhase, cloneState } from './replay.js';
import { applyBoardTransform } from './axial.js';

// Reflect every ring of state under transformIndex `t` to construct an
// equivalent state — used to verify that canonicalization collapses
// rotated/reflected positions onto the same hash.
function transformState(state, t) {
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

describe('canonicalizeState', () => {
  it('canonical hash is identical across all 12 symmetries on a 37-ring board', () => {
    // Set up a non-trivial state so transforms aren't accidentally equivalent.
    const s = createInitialState(37);
    const ringIds = Array.from(s.rings.keys());
    s.rings.get(ringIds[0]).marble = { color: 'white' };
    s.rings.get(ringIds[5]).marble = { color: 'black' };
    s.reserve.white = 5;

    const baseHash = hashPosition(canonicalizeState(s).canonicalString);
    for (let t = 0; t < 12; t++) {
      const transformed = transformState(s, t);
      const hash = hashPosition(canonicalizeState(transformed).canonicalString);
      expect(hash).toBe(baseHash);
    }
  });

  it('initial states for different board sizes hash differently', () => {
    const h37 = hashPosition(canonicalizeState(createInitialState(37)).canonicalString);
    const h48 = hashPosition(canonicalizeState(createInitialState(48)).canonicalString);
    const h61 = hashPosition(canonicalizeState(createInitialState(61)).canonicalString);
    expect(h37).not.toBe(h48);
    expect(h37).not.toBe(h61);
    expect(h48).not.toBe(h61);
  });

  it('different reserve counts produce different hashes', () => {
    const s1 = createInitialState(37);
    const s2 = createInitialState(37);
    s2.reserve.white = 5;
    expect(hashPosition(canonicalizeState(s1).canonicalString))
      .not.toBe(hashPosition(canonicalizeState(s2).canonicalString));
  });

  it('different currentPlayer produces different hashes', () => {
    const s1 = createInitialState(37);
    const s2 = createInitialState(37);
    s2.currentPlayer = 'player2';
    expect(hashPosition(canonicalizeState(s1).canonicalString))
      .not.toBe(hashPosition(canonicalizeState(s2).canonicalString));
  });

  it('after a placement, rotated/reflected states still hash the same', () => {
    const s = createInitialState(37);
    // Center hex is at (0, 3) for board 37 — pick a non-central ring.
    applyMove(s, {
      type: 'placement',
      data: { marbleColor: 'white', ringId: '0,0', removedRingId: '3,0' },
    });
    normalizePhase(s);

    const baseHash = hashPosition(canonicalizeState(s).canonicalString);
    for (let t = 0; t < 12; t++) {
      const tr = transformState(s, t);
      expect(hashPosition(canonicalizeState(tr).canonicalString)).toBe(baseHash);
    }
  });
});

describe('canonicalizeMove', () => {
  it('move from a canonicalized state lands on the same canonical move under any starting transform', () => {
    const s = createInitialState(37);
    applyMove(s, {
      type: 'placement',
      data: { marbleColor: 'white', ringId: '0,0', removedRingId: '3,0' },
    });
    normalizePhase(s);

    const baseMove = {
      type: 'placement',
      data: { marbleColor: 'gray', ringId: '1,1', removedRingId: '-1,3' },
    };

    const baseCanon = canonicalizeState(s);
    const baseCanonMove = canonicalizeMove(baseMove, baseCanon.transformIndices, s.boardSize);
    const baseKey = JSON.stringify(baseCanonMove);

    for (let t = 0; t < 12; t++) {
      const tr = transformState(s, t);
      // Apply the same starting transform to the move, then canonicalize.
      const trMove = {
        type: 'placement',
        data: {
          marbleColor: 'gray',
          ringId: idAfter('1,1', t, s.boardSize),
          removedRingId: idAfter('-1,3', t, s.boardSize),
        },
      };
      const canon = canonicalizeState(tr);
      const canonMove = canonicalizeMove(trMove, canon.transformIndices, s.boardSize);
      expect(JSON.stringify(canonMove)).toBe(baseKey);
    }
  });
});

function idAfter(id, t, size) {
  const [q, r] = id.split(',').map(Number);
  const out = applyBoardTransform(q, r, size, t);
  return `${out.q},${out.r}`;
}
