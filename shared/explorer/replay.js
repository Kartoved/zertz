/**
 * Minimal ZERTZ state-replay engine for the opening explorer indexer.
 *
 * Mirrors the move-application logic from src/game/GameEngine.ts but only
 * what's needed to compute boundary positions: no notation, no win check,
 * no validation (moves are trusted because they came from previously
 * verified game trees).
 *
 * Keep in sync with src/game/GameEngine.ts when the engine changes.
 */

import { generateBoardCoords } from './axial.js';

const INITIAL_RESERVE = { white: 6, gray: 8, black: 10 };

const HEX_DIRECTIONS = [
  { q: 1, r: 0 },  { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

function coordToId(q, r) { return `${q},${r}`; }
function idToCoord(id) { const [q, r] = id.split(',').map(Number); return { q, r }; }

function createInitialState(boardSize) {
  const rings = new Map();
  for (const c of generateBoardCoords(boardSize)) {
    const id = coordToId(c.q, c.r);
    rings.set(id, { id, q: c.q, r: c.r, marble: null, isRemoved: false });
  }
  return {
    rings,
    boardSize,
    reserve: { ...INITIAL_RESERVE },
    currentPlayer: 'player1',
    captures: {
      player1: { white: 0, gray: 0, black: 0 },
      player2: { white: 0, gray: 0, black: 0 },
    },
    phase: 'placement',
    pendingPlacement: null,
    winner: null,
    moveNumber: 1,
  };
}

function cloneState(state) {
  const rings = new Map();
  for (const [k, v] of state.rings) {
    rings.set(k, { ...v, marble: v.marble ? { ...v.marble } : null });
  }
  return {
    ...state,
    rings,
    reserve: { ...state.reserve },
    captures: {
      player1: { ...state.captures.player1 },
      player2: { ...state.captures.player2 },
    },
    pendingPlacement: state.pendingPlacement ? { ...state.pendingPlacement } : null,
  };
}

function getNeighborIds(ringId, rings) {
  const { q, r } = idToCoord(ringId);
  const out = [];
  for (const d of HEX_DIRECTIONS) {
    const nid = coordToId(q + d.q, r + d.r);
    const n = rings.get(nid);
    if (n && !n.isRemoved) out.push(nid);
  }
  return out;
}

function getIsolatedGroups(rings) {
  const active = [];
  for (const r of rings.values()) if (!r.isRemoved) active.push(r);
  const visited = new Set();
  const groups = [];
  for (const ring of active) {
    if (visited.has(ring.id)) continue;
    const group = [];
    const queue = [ring.id];
    visited.add(ring.id);
    while (queue.length > 0) {
      const cid = queue.shift();
      group.push(cid);
      for (const nid of getNeighborIds(cid, rings)) {
        if (!visited.has(nid)) { visited.add(nid); queue.push(nid); }
      }
    }
    groups.push(group);
  }
  return groups;
}

// Mirror of GameEngine.handleIsolation: when removing a ring splits the board
// into multiple groups, the smaller group(s) — provided they're fully filled
// (no empty rings) — are awarded to the current player and removed from play.
function handleIsolation(state) {
  const groups = getIsolatedGroups(state.rings);
  if (groups.length <= 1) return;

  let mainIdx = 0;
  let maxSize = 0;
  for (let i = 0; i < groups.length; i++) {
    if (groups[i].length > maxSize) { maxSize = groups[i].length; mainIdx = i; }
  }

  for (let i = 0; i < groups.length; i++) {
    if (i === mainIdx) continue;
    const g = groups[i];
    let hasEmpty = false;
    for (const id of g) {
      const ring = state.rings.get(id);
      if (ring && !ring.marble) { hasEmpty = true; break; }
    }
    if (hasEmpty) continue;
    for (const id of g) {
      const ring = state.rings.get(id);
      if (!ring) continue;
      if (ring.marble) {
        state.captures[state.currentPlayer][ring.marble.color]++;
        ring.marble = null;
      }
      ring.isRemoved = true;
    }
  }
}

function placeMarble(state, ringId, color) {
  const ring = state.rings.get(ringId);
  if (!ring) return;
  const reserveTotal = state.reserve.white + state.reserve.gray + state.reserve.black;
  if (reserveTotal > 0) {
    state.reserve[color]--;
  } else {
    state.captures[state.currentPlayer][color]--;
  }
  ring.marble = { color };
  state.pendingPlacement = { ringId, marbleColor: color };
  state.phase = 'ringRemoval';
}

function removeRing(state, ringId) {
  const ring = state.rings.get(ringId);
  if (!ring) return;
  ring.isRemoved = true;
  handleIsolation(state);
  state.pendingPlacement = null;
  state.phase = 'placement';
  state.currentPlayer = state.currentPlayer === 'player1' ? 'player2' : 'player1';
  state.moveNumber++;
}

function executeCaptureSingle(state, capture) {
  const fromRing = state.rings.get(capture.from);
  const toRing = state.rings.get(capture.to);
  const capRing = state.rings.get(capture.captured);
  if (!fromRing || !toRing || !capRing || !fromRing.marble || !capRing.marble) return;
  toRing.marble = fromRing.marble;
  fromRing.marble = null;
  state.captures[state.currentPlayer][capRing.marble.color]++;
  capRing.marble = null;
}

function executeCapture(state, captures) {
  for (const c of captures) executeCaptureSingle(state, c);
  state.currentPlayer = state.currentPlayer === 'player1' ? 'player2' : 'player1';
  state.moveNumber++;
}

/**
 * Apply a tree-node move in place. Trusts that `move` is valid (it came
 * from a previously-verified game tree).
 *
 * @param {object} state  Mutable state (rings is a Map).
 * @param {object} move   { type: 'placement'|'capture', data: ... }
 */
function applyMove(state, move) {
  if (move.type === 'placement') {
    placeMarble(state, move.data.ringId, move.data.marbleColor);
    if (move.data.removedRingId) {
      removeRing(state, move.data.removedRingId);
    } else {
      // No removable ring at this turn — engine auto-skipped removal.
      state.pendingPlacement = null;
      state.phase = 'placement';
      state.currentPlayer = state.currentPlayer === 'player1' ? 'player2' : 'player1';
      state.moveNumber++;
    }
  } else if (move.type === 'capture') {
    const captures = [move.data, ...(move.data.chain || [])];
    executeCapture(state, captures);
  }
}

// Detects whether the side-to-move has a mandatory capture from the current
// position. Used to normalize phase to 'capture' on boundary states.
function hasAvailableCaptures(state) {
  for (const ring of state.rings.values()) {
    if (ring.isRemoved || !ring.marble) continue;
    const { q, r } = ring;
    for (const d of HEX_DIRECTIONS) {
      const midId = coordToId(q + d.q, r + d.r);
      const mid = state.rings.get(midId);
      if (!mid || mid.isRemoved || !mid.marble) continue;
      const behindId = coordToId(q + 2 * d.q, r + 2 * d.r);
      const behind = state.rings.get(behindId);
      if (behind && !behind.isRemoved && !behind.marble) return true;
    }
  }
  return false;
}

/**
 * Normalize the boundary phase: after applyMove, the engine leaves phase as
 * 'placement' even when captures are mandatory. Match the client's behavior
 * (utils/moveActions.normalizePhase) so boundary positions hash the same.
 */
function normalizePhase(state) {
  if (state.winner || state.phase === 'gameOver' || state.phase === 'ringRemoval') return;
  state.phase = hasAvailableCaptures(state) ? 'capture' : 'placement';
}

export {
  createInitialState,
  cloneState,
  applyMove,
  hasAvailableCaptures,
  normalizePhase,
  // exported for tests
  placeMarble,
  removeRing,
  executeCapture,
};
