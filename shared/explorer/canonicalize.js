/**
 * Position and move canonicalization.
 *
 * The board's symmetry group means many literally distinct (q,r)
 * configurations are tactically identical. We pick a canonical
 * representative by trying each valid transform and keeping the one whose
 * serialization is lexicographically smallest. Same selected transform is
 * applied to the move played from that position so that "move from
 * position X" aggregates correctly across rotations and reflections.
 *
 * Pure functions — no mutation of inputs.
 */

import { boardSymmetries, applyBoardTransform, inverseTransform } from './axial.js';

const COLOR_CHAR = { white: 'w', gray: 'g', black: 'b' };
const PLAYER_CHAR = { player1: '1', player2: '2' };
const PHASE_CHAR = { placement: 'P', capture: 'C', ringRemoval: 'R', gameOver: 'G' };

/**
 * Serialize a state under a particular transform. The returned string
 * encodes every position-relevant field; transformed ring coordinates are
 * sorted so the order of iteration over rings doesn't affect the output.
 */
function serializeUnderTransform(state, transformIndex) {
  const { boardSize } = state;
  const ringStrs = [];
  for (const ring of state.rings.values()) {
    const t = applyBoardTransform(ring.q, ring.r, boardSize, transformIndex);
    let cell;
    if (ring.isRemoved) cell = '-';
    else if (ring.marble) cell = COLOR_CHAR[ring.marble.color];
    else cell = '.';
    ringStrs.push(`${t.q},${t.r}:${cell}`);
  }
  ringStrs.sort();
  const ringPart = ringStrs.join('|');

  const reserve = state.reserve;
  const c1 = state.captures.player1;
  const c2 = state.captures.player2;
  const meta = [
    `bs${boardSize}`,
    `p${PLAYER_CHAR[state.currentPlayer]}`,
    `f${PHASE_CHAR[state.phase] || '?'}`,
    `r${reserve.white},${reserve.gray},${reserve.black}`,
    `c1${c1.white},${c1.gray},${c1.black}`,
    `c2${c2.white},${c2.gray},${c2.black}`,
  ].join(';');

  return `${meta}|${ringPart}`;
}

/**
 * Returns { canonicalString, transformIndices } — the lex-smallest
 * serialization across the board's symmetry group, plus the SET of
 * transforms that produce that string.
 *
 * Multiple transforms can tie when the state has internal symmetry (e.g.
 * the empty initial state has all 12 transforms tied). In that case
 * canonicalizeMove must check all tied transforms and pick the one that
 * yields the smallest serialized move — otherwise two physically
 * equivalent moves from a symmetric state could canonicalize to different
 * representatives.
 *
 * @param {object} state
 * @returns {{ canonicalString: string, transformIndices: number[] }}
 */
function canonicalizeState(state) {
  const symmetries = boardSymmetries(state.boardSize);
  let bestStr = null;
  let bestIndices = [];
  for (const t of symmetries) {
    const s = serializeUnderTransform(state, t);
    if (bestStr === null || s < bestStr) {
      bestStr = s;
      bestIndices = [t];
    } else if (s === bestStr) {
      bestIndices.push(t);
    }
  }
  return { canonicalString: bestStr, transformIndices: bestIndices };
}

/**
 * Apply each transform in `transformIndices` to the move and return the
 * one with the lex-smallest JSON serialization. Across two equivalent
 * (state, move) pairs, this yields the same canonical move.
 *
 * @param {object} move
 * @param {number[]} transformIndices  From canonicalizeState.
 * @param {37|48|61} boardSize
 */
function canonicalizeMove(move, transformIndices, boardSize) {
  let best = null;
  let bestKey = null;
  for (const t of transformIndices) {
    const candidate = (t === 0) ? cloneMove(move) : applyTransformToMove(move, t, boardSize);
    const key = JSON.stringify(candidate);
    if (bestKey === null || key < bestKey) {
      best = candidate;
      bestKey = key;
    }
  }
  return best;
}

function applyTransformToMove(move, transformIndex, boardSize) {
  if (move.type === 'placement') {
    const data = move.data;
    return {
      type: 'placement',
      data: {
        marbleColor: data.marbleColor,
        ringId: transformId(data.ringId, transformIndex, boardSize),
        removedRingId: data.removedRingId
          ? transformId(data.removedRingId, transformIndex, boardSize)
          : null,
        ...(data.isolatedCaptures ? { isolatedCaptures: [...data.isolatedCaptures] } : {}),
      },
    };
  }
  // capture
  const head = transformCapture(move.data, transformIndex, boardSize);
  if (move.data.chain) {
    head.chain = move.data.chain.map(c => transformCapture(c, transformIndex, boardSize));
  }
  return { type: 'capture', data: head };
}

function cloneMove(move) {
  if (move.type === 'placement') {
    return { type: 'placement', data: { ...move.data, ...(move.data.isolatedCaptures ? { isolatedCaptures: [...move.data.isolatedCaptures] } : {}) } };
  }
  const head = { ...move.data };
  if (move.data.chain) head.chain = move.data.chain.map(c => ({ ...c }));
  return { type: 'capture', data: head };
}

function transformId(id, transformIndex, boardSize) {
  const [q, r] = id.split(',').map(Number);
  const t = applyBoardTransform(q, r, boardSize, transformIndex);
  return `${t.q},${t.r}`;
}

function transformCapture(c, transformIndex, boardSize) {
  return {
    from: transformId(c.from, transformIndex, boardSize),
    to: transformId(c.to, transformIndex, boardSize),
    captured: transformId(c.captured, transformIndex, boardSize),
    ...(c.marbleColor ? { marbleColor: c.marbleColor } : {}),
    ...(c.capturedColor ? { capturedColor: c.capturedColor } : {}),
  };
}

/**
 * Inverse of canonicalizeMove: bring a canonical-frame move back into the
 * caller's frame. Caller passes the `transformIndices` returned from
 * canonicalizeState on their CURRENT state. Picks the first index for
 * determinism — when the state has internal symmetry all candidate
 * inverses yield equivalent moves in the caller's frame.
 */
function decanonicalizeMove(move, transformIndices, boardSize) {
  const t = inverseTransform(transformIndices[0]);
  if (t === 0) return cloneMove(move);
  return applyTransformToMove(move, t, boardSize);
}

export {
  serializeUnderTransform,
  canonicalizeState,
  canonicalizeMove,
  decanonicalizeMove,
};
