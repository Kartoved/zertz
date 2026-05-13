/**
 * Server-side state verification for PUT /api/rooms/:id/state.
 *
 * The client owns the game engine and computes the next state locally, then
 * sends both the new state_json and the new tree_json. To prevent rated-game
 * tampering, we re-derive the state from the tree on the server (using the
 * shared replay engine) and compare against what the client claims.
 *
 * What we verify:
 *   - rings (which are removed; which marble is on each)
 *   - captures (per-player, per-color)
 *   - reserve
 *   - currentPlayer
 *   - moveNumber
 *   - winner: must match the natural win detected from the replayed captures
 *
 * What we DON'T verify (and why):
 *   - Intermediate states between placement and ringRemoval (pendingPlacement
 *     set). The move isn't complete yet; the next /state call will be verified
 *     against the completed tree.
 *   - Surrender (winType === 'surrender'). The winner is the opponent of the
 *     submitter regardless of board state; captures/etc are irrelevant.
 */

import {
  createInitialState,
  applyMove,
  normalizePhase,
} from '../../shared/explorer/replay.js';

// Mirror src/game/types.ts WIN_CONDITIONS.
const WIN_CONDITIONS = { white: 4, gray: 5, black: 6, allColors: 3 };

function naturalWinner(state) {
  for (const player of ['player1', 'player2']) {
    const c = state.captures[player];
    if (c.white >= WIN_CONDITIONS.white) return player;
    if (c.gray >= WIN_CONDITIONS.gray) return player;
    if (c.black >= WIN_CONDITIONS.black) return player;
    if (
      c.white >= WIN_CONDITIONS.allColors &&
      c.gray >= WIN_CONDITIONS.allColors &&
      c.black >= WIN_CONDITIONS.allColors
    ) {
      return player;
    }
  }
  return null;
}

function mainLineMoves(treeRoot) {
  const moves = [];
  let node = treeRoot;
  while (node && Array.isArray(node.children) && node.children.length > 0) {
    node = node.children[0];
    if (node && node.move) moves.push(node.move);
  }
  return moves;
}

function deserializeStateJson(json) {
  const parsed = JSON.parse(json);
  parsed.rings = new Map(parsed.rings);
  if (!parsed.captures) {
    parsed.captures = {
      player1: { white: 0, gray: 0, black: 0 },
      player2: { white: 0, gray: 0, black: 0 },
    };
  }
  return parsed;
}

function captureEq(a, b) {
  return a && b && a.white === b.white && a.gray === b.gray && a.black === b.black;
}

function ringsMatch(serverRings, clientRings) {
  if (serverRings.size !== clientRings.size) {
    return { ok: false, reason: 'ring-count-mismatch' };
  }
  for (const [id, sr] of serverRings) {
    const cr = clientRings.get(id);
    if (!cr) return { ok: false, reason: `missing-ring:${id}` };
    if (!!sr.isRemoved !== !!cr.isRemoved) {
      return { ok: false, reason: `ring-removed-mismatch:${id}` };
    }
    const sm = sr.marble ? sr.marble.color : null;
    const cm = cr.marble ? cr.marble.color : null;
    if (sm !== cm) return { ok: false, reason: `marble-mismatch:${id}` };
  }
  return { ok: true };
}

/**
 * Verify a client-submitted state against its tree.
 *
 * @param {object} args
 * @param {string} args.stateJson  Client state JSON.
 * @param {string} args.treeJson   Client tree JSON.
 * @param {37|48|61} args.boardSize
 * @param {string|null} args.winType  e.g. 'surrender', 'white', null.
 * @param {1|2} args.playerIndex  Submitting player (derived from auth).
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
export function verifySubmittedState({ stateJson, treeJson, boardSize, winType, playerIndex }) {
  let tree, clientState;
  try { tree = JSON.parse(treeJson); }
  catch { return { ok: false, reason: 'bad-tree-json' }; }
  try { clientState = deserializeStateJson(stateJson); }
  catch { return { ok: false, reason: 'bad-state-json' }; }

  // Surrender: skip deep verification — board state is irrelevant to the
  // outcome; we just enforce the resignation is against the submitter.
  if (winType === 'surrender') {
    const expected = playerIndex === 1 ? 'player2' : 'player1';
    if (clientState.winner !== expected) {
      return { ok: false, reason: 'surrender-must-credit-opponent' };
    }
    return { ok: true };
  }

  // Intermediate state (between placement and ringRemoval): skip verification.
  // The next /state call will replay the completed tree and catch any tampering.
  if (clientState.pendingPlacement) return { ok: true };

  // Replay the tree on the server.
  let serverState;
  try {
    serverState = createInitialState(boardSize);
    for (const move of mainLineMoves(tree)) {
      applyMove(serverState, move);
    }
    normalizePhase(serverState);
  } catch (err) {
    return { ok: false, reason: `replay-error:${err.message}` };
  }

  // Compare core invariants.
  const rc = ringsMatch(serverState.rings, clientState.rings);
  if (!rc.ok) return rc;

  if (!captureEq(serverState.captures.player1, clientState.captures.player1)) {
    return { ok: false, reason: 'captures-p1-mismatch' };
  }
  if (!captureEq(serverState.captures.player2, clientState.captures.player2)) {
    return { ok: false, reason: 'captures-p2-mismatch' };
  }
  if (!captureEq(serverState.reserve, clientState.reserve)) {
    return { ok: false, reason: 'reserve-mismatch' };
  }
  if (serverState.currentPlayer !== clientState.currentPlayer) {
    return { ok: false, reason: 'currentPlayer-mismatch' };
  }
  if (serverState.moveNumber !== clientState.moveNumber) {
    return { ok: false, reason: 'moveNumber-mismatch' };
  }

  // Winner must equal the natural win on the replayed captures.
  const serverWinner = naturalWinner(serverState);
  const clientWinner = clientState.winner === 'player1' || clientState.winner === 'player2'
    ? clientState.winner
    : null;
  if (serverWinner !== clientWinner) {
    return { ok: false, reason: 'winner-mismatch' };
  }

  return { ok: true };
}
