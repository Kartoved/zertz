/**
 * Game-tree indexer for the opening explorer.
 *
 * Given a parsed game tree (JSON form, like rooms.tree_json), walks the
 * main line and yields one entry per move:
 *   {
 *     positionHash:  hash of the BOUNDARY position before this move was played
 *     boardSize,
 *     ply:           1-based position in the game (1 = first move)
 *     move:          the canonicalized move (in the canonical frame)
 *     moveNotation:  human-readable notation in the canonical frame
 *   }
 *
 * Pure: doesn't touch the database. Server callers stitch this with game
 * metadata (winner, player IDs, etc.) when writing to position_moves and
 * position_games.
 */

import { createInitialState, applyMove, normalizePhase } from './replay.js';
import { canonicalizeState, canonicalizeMove } from './canonicalize.js';
import { hashPosition } from './hash.js';
import { generateBoardCoords } from './axial.js';

/**
 * Walks the main line (children[0] chain) of a game tree and yields one
 * entry per move with the boundary position hash before the move.
 *
 * Skips entries where the boundary phase is 'gameOver' (no moves to index
 * after a win) and filters out non-main-line branches.
 *
 * @param {object} treeRoot  Root GameNode (move=null, children at index 0
 *                           is the first played move).
 * @param {37|48|61} boardSize
 * @returns {Array<{positionHash:string, boardSize:number, ply:number, move:object, moveNotation:string}>}
 */
export function indexGameTree(treeRoot, boardSize) {
  const entries = [];
  if (!treeRoot || !Array.isArray(treeRoot.children)) return entries;

  const state = createInitialState(boardSize);
  normalizePhase(state);

  let node = treeRoot;
  let ply = 1;

  while (node.children && node.children.length > 0) {
    const next = node.children[0]; // main line
    if (!next.move) break;

    // Don't index moves played after a terminal state.
    if (state.phase === 'gameOver' || state.winner) break;

    const { canonicalString, transformIndices } = canonicalizeState(state);
    const positionHash = hashPosition(canonicalString);
    const canonMove = canonicalizeMove(next.move, transformIndices, boardSize);
    const moveNotation = notationFor(canonMove, boardSize);

    entries.push({
      positionHash,
      boardSize,
      ply,
      move: canonMove,
      moveNotation,
    });

    applyMove(state, next.move);
    normalizePhase(state);

    node = next;
    ply++;
  }

  return entries;
}

// ---- Notation helpers (operate on canonical-frame coordinates) ----

const COLOR_INITIAL = { white: 'W', gray: 'G', black: 'B' };

/**
 * Render a canonical-frame move to algebraic notation.
 * Mirrors src/game/GameEngine.ts moveToNotation but only what's needed for
 * display in the explorer panel (no isolation suffix or capture-detail
 * embellishments — those can be added later if useful).
 */
function notationFor(move, boardSize) {
  if (move.type === 'placement') {
    const { marbleColor, ringId, removedRingId } = move.data;
    const c = COLOR_INITIAL[marbleColor] || '?';
    const head = `${c}${idToAlgebraic(ringId, boardSize)}`;
    return removedRingId ? `${head} -${idToAlgebraic(removedRingId, boardSize)}` : head;
  }
  // capture
  const chain = [move.data, ...(move.data.chain || [])];
  const c = move.data.marbleColor ? COLOR_INITIAL[move.data.marbleColor] : '?';
  const fromAlg = idToAlgebraic(chain[0].from, boardSize);
  const positions = chain.map(c2 => idToAlgebraic(c2.to, boardSize));
  return `${c}${fromAlg}×${positions.join('×')}`;
}

// Algebraic-notation lookup table derived from the board template for
// `boardSize`. Mirrors Board.idToAlgebraic. Cached because notation is
// computed for every indexed move.
const algebraicCache = new Map();
function getAlgebraicTable(boardSize) {
  if (algebraicCache.has(boardSize)) return algebraicCache.get(boardSize);
  const coords = generateBoardCoords(boardSize);
  let minQ = Infinity;
  const maxRByCol = new Map();
  for (const c of coords) {
    if (c.q < minQ) minQ = c.q;
    const prev = maxRByCol.get(c.q);
    if (prev === undefined || c.r > prev) maxRByCol.set(c.q, c.r);
  }
  const table = { minQ, maxRByCol };
  algebraicCache.set(boardSize, table);
  return table;
}

function idToAlgebraic(id, boardSize) {
  const [q, r] = id.split(',').map(Number);
  const { minQ, maxRByCol } = getAlgebraicTable(boardSize);
  const col = String.fromCharCode(97 + (q - minQ));
  const maxR = maxRByCol.get(q);
  if (maxR === undefined) return id; // Fallback if coord falls off-template.
  const row = maxR + 1 - r;
  return `${col}${row}`;
}
