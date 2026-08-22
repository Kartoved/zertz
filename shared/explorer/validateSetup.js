/**
 * Server-side validation of a custom start position (imported ZIP / editor
 * position) before it becomes the `setup_json` of a rated online room.
 *
 * The client owns the position editor and codec; without this check the server
 * trusts an arbitrary client-supplied starting position for a RATED game. This
 * closes the gross-tampering holes: invented marbles, corrupted board geometry,
 * or a position that is already won.
 *
 * What we DON'T reject: a conserved head-start (e.g. the creator already holds
 * some captures). Mid-game positions are a legitimate custom-start use case and
 * both players see the board before joining, so we only guarantee the position
 * is a *plausible, well-formed, not-yet-decided* ZERTZ position.
 *
 * Runs in both Node (server) and the browser (shares axial geometry with the
 * client), so it has no node-only deps.
 */

import { generateBoardCoords } from './axial.js';

// Mirror src/game/types.ts INITIAL_RESERVE — the fixed marble supply.
const SUPPLY = { white: 6, gray: 8, black: 10 };
// Mirror src/game/types.ts WIN_CONDITIONS.
const WIN_CONDITIONS = { white: 4, gray: 5, black: 6, allColors: 3 };
const COLORS = ['white', 'gray', 'black'];

function coordToId(q, r) { return `${q},${r}`; }

function isTriple(t) {
  if (!t || typeof t !== 'object') return false;
  return COLORS.every(c => Number.isInteger(t[c]) && t[c] >= 0);
}

function alreadyWon(caps) {
  for (const player of ['player1', 'player2']) {
    const c = caps[player];
    if (c.white >= WIN_CONDITIONS.white) return true;
    if (c.gray >= WIN_CONDITIONS.gray) return true;
    if (c.black >= WIN_CONDITIONS.black) return true;
    if (
      c.white >= WIN_CONDITIONS.allColors &&
      c.gray >= WIN_CONDITIONS.allColors &&
      c.black >= WIN_CONDITIONS.allColors
    ) return true;
  }
  return false;
}

/**
 * @param {string|object} setup  serialized GameState (JSON string or parsed
 *   object with `rings` as a Map or an array of [id, ring] entries).
 * @param {37|48|61} boardSize
 * @returns {{ok:true} | {ok:false, reason:string}}
 */
export function validateSetupState(setup, boardSize) {
  if (![37, 48, 61].includes(Number(boardSize))) {
    return { ok: false, reason: 'bad-board-size' };
  }

  let state;
  if (typeof setup === 'string') {
    try { state = JSON.parse(setup); } catch { return { ok: false, reason: 'bad-json' }; }
  } else if (setup && typeof setup === 'object') {
    state = setup;
  } else {
    return { ok: false, reason: 'bad-setup' };
  }

  // Normalize rings to an [id, ring] entry list.
  let entries;
  if (state.rings instanceof Map) entries = Array.from(state.rings.entries());
  else if (Array.isArray(state.rings)) entries = state.rings;
  else return { ok: false, reason: 'bad-rings' };

  const template = new Set(generateBoardCoords(Number(boardSize)).map(c => coordToId(c.q, c.r)));

  const seen = new Set();
  const onBoard = { white: 0, gray: 0, black: 0 };
  let nonRemoved = 0;

  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length !== 2) return { ok: false, reason: 'bad-ring-entry' };
    const [id, ring] = entry;
    if (!ring || typeof ring !== 'object') return { ok: false, reason: `bad-ring:${id}` };
    if (!Number.isInteger(ring.q) || !Number.isInteger(ring.r)) return { ok: false, reason: `bad-coord:${id}` };
    if (coordToId(ring.q, ring.r) !== id || ring.id !== id) return { ok: false, reason: `coord-id-mismatch:${id}` };
    if (!template.has(id)) return { ok: false, reason: `off-board-ring:${id}` };
    if (seen.has(id)) return { ok: false, reason: `duplicate-ring:${id}` };
    seen.add(id);

    if (ring.isRemoved) continue;
    nonRemoved++;
    if (ring.marble) {
      const color = ring.marble.color;
      if (!COLORS.includes(color)) return { ok: false, reason: `bad-marble:${id}` };
      onBoard[color]++;
    }
  }

  // The serialized board must describe the full template (removed rings are kept
  // as isRemoved) — no missing or extra cells.
  if (seen.size !== template.size) return { ok: false, reason: 'ring-set-mismatch' };
  if (nonRemoved === 0) return { ok: false, reason: 'no-playable-ring' };

  if (!isTriple(state.reserve)) return { ok: false, reason: 'bad-reserve' };
  const caps = state.captures || {};
  if (!isTriple(caps.player1) || !isTriple(caps.player2)) return { ok: false, reason: 'bad-captures' };

  // Marble conservation: nothing invented, nothing lost.
  for (const c of COLORS) {
    const total = onBoard[c] + state.reserve[c] + caps.player1[c] + caps.player2[c];
    if (total !== SUPPLY[c]) return { ok: false, reason: `marble-conservation:${c}:${total}!=${SUPPLY[c]}` };
  }

  if (state.currentPlayer !== 'player1' && state.currentPlayer !== 'player2') {
    return { ok: false, reason: 'bad-current-player' };
  }

  // A start position must not be already decided.
  if (alreadyWon(caps)) return { ok: false, reason: 'already-won' };

  return { ok: true };
}
