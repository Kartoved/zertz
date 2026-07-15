// ZEN — ZErtz Notation. Move tokens (and, later, whole-game movetext) — the PGN
// analog. See docs/ZEN_ZIP_NOTATION.md.
//
// A move (one whole turn) is one whitespace-free ASCII token:
//   placement            Wb3
//   placement + removal   Wb3-c4
//   capture chain         Wa4xc4xe5
//   + captured colors     Wa4xc4xe5+wg   (suffix, optional/derivable)
//
// Delimiters: '-' ring removal (placement only), 'x' next jump, '+' color suffix.
// Uppercase = marble color, lowercase = column / captured color.
//
// Coordinates are INTRINSIC to the position (leftmost column = 'a', per-column
// bottom = row 1) — no board-size dependency. For a standard full board this
// matches the engine's idToAlgebraic. For a game, build the labels ONCE from the
// start position and reuse them, so a cell keeps its name even after rings around
// it are removed.

import { GameState, GameNode, Move, MarbleColor, CaptureMove, Shape, ShapeBrush } from './types';
import { idToCoord, coordToId } from './Board';
import {
  cloneState, placeMarble, removeRing, skipRingRemoval, executeCapture, checkWinCondition,
} from './GameEngine';
import { addMoveToTree, createRootNode } from '../utils/gameTreeUtils';
import { normalizePhase } from '../utils/moveActions';
import { stateToZip, zipToState } from './zip';

const COLOR_TO_CHAR: Record<MarbleColor, string> = { white: 'W', gray: 'G', black: 'B' };
const CHAR_TO_COLOR: Record<string, MarbleColor> = {
  W: 'white', G: 'gray', B: 'black', w: 'white', g: 'gray', b: 'black',
};

export interface ZenLabels {
  toAlg: (id: string) => string;
  toId: (alg: string) => string;
}

// Build intrinsic algebraic labels from a reference position (use the game's
// START state so labels stay stable across the game). Mirrors idToAlgebraic but
// derives minQ / per-column max-r from the rings themselves, not a board template.
export function buildLabels(state: GameState): ZenLabels {
  let minQ = Infinity;
  const maxRByCol = new Map<number, number>();
  for (const ring of state.rings.values()) {
    if (ring.q < minQ) minQ = ring.q;
    const prev = maxRByCol.get(ring.q);
    if (prev === undefined || ring.r > prev) maxRByCol.set(ring.q, ring.r);
  }

  const toAlg = (id: string): string => {
    const { q, r } = idToCoord(id);
    const col = String.fromCharCode(97 + (q - minQ));
    const row = (maxRByCol.get(q) ?? r) + 1 - r;
    return `${col}${row}`;
  };

  // Reverse table.
  const algToId = new Map<string, string>();
  for (const ring of state.rings.values()) algToId.set(toAlg(ring.id), ring.id);
  const toId = (alg: string): string => {
    const id = algToId.get(alg);
    if (id === undefined) throw new Error(`ZEN: unknown cell '${alg}'`);
    return id;
  };

  return { toAlg, toId };
}

// ─────────────────────────────── emit ───────────────────────────────

export function moveToZen(move: Move, labels: ZenLabels): string {
  const { toAlg } = labels;
  if (move.type === 'capture') {
    const chain = [move.data, ...(move.data.chain || [])];
    const c = chain[0].marbleColor ? COLOR_TO_CHAR[chain[0].marbleColor] : '?';
    let s = c + toAlg(chain[0].from) + chain.map(cap => 'x' + toAlg(cap.to)).join('');
    const caps = chain.map(cap => (cap.capturedColor ? cap.capturedColor[0] : '')).filter(Boolean);
    if (caps.length) s += '+' + caps.join('');
    return s;
  }
  const { marbleColor, ringId, removedRingId, isolatedCaptures } = move.data;
  let s = COLOR_TO_CHAR[marbleColor] + toAlg(ringId);
  if (removedRingId) s += '-' + toAlg(removedRingId);
  if (isolatedCaptures && isolatedCaptures.length) {
    s += '+' + isolatedCaptures.map(col => col[0]).join('');
  }
  return s;
}

// ─────────────────────────────── parse ───────────────────────────────

// Parse one ZEN move token into a Move. Colors that are derivable (capturedColor,
// isolatedCaptures) are left unset — a replayer recomputes them. `×` is accepted
// as an alias for `x`.
export function zenToMove(token: string, labels: ZenLabels): Move {
  const { toId } = labels;
  const t = token.trim().replace(/×/g, 'x');
  if (t.length < 2) throw new Error(`ZEN: malformed move '${token}'`);

  const marbleColor = CHAR_TO_COLOR[t[0]];
  if (!marbleColor) throw new Error(`ZEN: bad marble color in '${token}'`);

  // Strip the optional '+colors' suffix (derivable, ignored on parse).
  const plus = t.indexOf('+');
  const body = (plus >= 0 ? t.slice(1, plus) : t.slice(1));

  if (body.includes('x')) {
    const cells = body.split('x').map(toId);
    if (cells.length < 2) throw new Error(`ZEN: capture needs ≥1 jump in '${token}'`);
    const jumps: CaptureMove[] = [];
    for (let i = 0; i < cells.length - 1; i++) {
      jumps.push({ from: cells[i], to: cells[i + 1], captured: midId(cells[i], cells[i + 1]) });
    }
    const [first, ...chain] = jumps;
    return { type: 'capture', data: { ...first, marbleColor, chain } };
  }

  // Placement (with optional ring removal).
  const dash = body.indexOf('-');
  const ringId = toId(dash >= 0 ? body.slice(0, dash) : body);
  const removedRingId = dash >= 0 ? toId(body.slice(dash + 1)) : null;
  return { type: 'placement', data: { marbleColor, ringId, removedRingId } };
}

// The jumped-over ring: the cell on the straight line halfway between from and to.
function midId(fromId: string, toId: string): string {
  const a = idToCoord(fromId);
  const b = idToCoord(toId);
  return coordToId((a.q + b.q) / 2, (a.r + b.r) / 2);
}

// ═══════════════════════════ whole-game movetext ═══════════════════════════
//
// A ZEN game = tag pairs + movetext (PGN-shaped). The start position rides in a
// `[ZIP "..."]` tag, so replay is fully self-contained. Movetext supports move
// numbering, `{comments}`, `(variations)` and Lichess-style annotations
// (`[%cal ...]` arrows / `[%csl ...]` circles) mapped to `GameNode.shapes`.

export type ZenMeta = Record<string, string>;

const BRUSH_TO_LETTER: Record<ShapeBrush, string> = { green: 'G', red: 'R', blue: 'B', yellow: 'Y' };
const LETTER_TO_BRUSH: Record<string, ShapeBrush> = { G: 'green', R: 'red', B: 'blue', Y: 'yellow' };

// ── emit ──

export function treeToZen(startState: GameState, root: GameNode, meta: ZenMeta = {}): string {
  const labels = buildLabels(startState);
  const tags: ZenMeta = { ZIP: stateToZip(startState), ...meta };

  const header = Object.entries(tags)
    .filter(([k]) => k !== 'Result')
    .map(([k, v]) => `[${k} "${v}"]`)
    .join('\n');

  const tokens: string[] = [];
  const rootComment = emitComment(root, labels);
  if (rootComment) tokens.push(rootComment);
  emitTreeLine(root, tokens, labels, true);
  tokens.push(tags.Result || meta.Result || '*');

  return `${header}\n\n${tokens.join(' ')}`;
}

function emitTreeLine(node: GameNode, tokens: string[], labels: ZenLabels, force: boolean): void {
  if (node.children.length === 0) return;
  const main = node.children[0];
  const commented = emitMove(main, force, tokens, labels);
  const variations = node.children.slice(1);
  for (const v of variations) {
    tokens.push('(');
    const vc = emitMove(v, true, tokens, labels);
    emitTreeLine(v, tokens, labels, vc);
    tokens.push(')');
  }
  emitTreeLine(main, tokens, labels, variations.length > 0 || commented);
}

// Emits the move for `node` (with a move number when needed) plus its comment.
// Returns true if a comment/annotation was emitted (an "interruption").
function emitMove(node: GameNode, force: boolean, tokens: string[], labels: ZenLabels): boolean {
  const full = Math.ceil(node.moveNumber / 2);
  if (node.player === 'player1') tokens.push(`${full}.`);
  else if (force) tokens.push(`${full}...`);
  tokens.push(moveToZen(node.move!, labels));
  const cmt = emitComment(node, labels);
  if (cmt) { tokens.push(cmt); return true; }
  return false;
}

function emitComment(node: GameNode, labels: ZenLabels): string {
  const parts: string[] = [];
  if (node.shapes && node.shapes.length) parts.push(emitShapes(node.shapes, labels));
  if (node.comment && node.comment.trim()) parts.push(node.comment.trim());
  return parts.length ? `{${parts.join(' ')}}` : '';
}

function emitShapes(shapes: Shape[], labels: ZenLabels): string {
  const { toAlg } = labels;
  const arrows = shapes.filter(s => s.dest).map(s => BRUSH_TO_LETTER[s.brush] + toAlg(s.orig) + toAlg(s.dest!));
  const circles = shapes.filter(s => !s.dest).map(s => BRUSH_TO_LETTER[s.brush] + toAlg(s.orig));
  let out = '';
  if (arrows.length) out += `[%cal ${arrows.join(',')}]`;
  if (circles.length) out += `[%csl ${circles.join(',')}]`;
  return out;
}

// ── parse ──

export function zenToTree(zen: string): { startState: GameState; root: GameNode; meta: ZenMeta } {
  const { meta, movetext } = splitTags(zen);
  if (!meta.ZIP) throw new Error('ZEN: missing [ZIP] start-position tag');
  const startState = zipToState(meta.ZIP);
  const labels = buildLabels(startState);
  const root = createRootNode();

  const toks = tokenize(movetext);
  let pos = 0;

  const parseLine = (node: GameNode, state: GameState): void => {
    // `node`/`state`: the current position. `prevNode`/`prevState`: the position
    // BEFORE the last move (a `(variation)` branches from there).
    let prevNode = node;
    let prevState = state;
    let lastNode = node; // a comment attaches to whatever move was last played

    while (pos < toks.length) {
      const tk = toks[pos];
      if (tk.type === 'RPAREN' || tk.type === 'RESULT') return;
      pos++;
      if (tk.type === 'NUMBER') continue;
      if (tk.type === 'COMMENT') { attachComment(lastNode, tk.value, labels); continue; }
      if (tk.type === 'LPAREN') {
        parseLine(prevNode, cloneState(prevState));
        if (toks[pos]?.type === 'RPAREN') pos++;
        continue;
      }
      // MOVE
      const move = zenToMove(tk.value, labels);
      const newNode = addMoveToTree(node, move, state.currentPlayer, state.moveNumber, state.boardSize);
      const newState = applyFullMove(state, move);
      prevNode = node; prevState = state;
      node = newNode; state = newState;
      lastNode = newNode;
    }
  };

  parseLine(root, startState);
  return { startState, root, meta };
}

function applyFullMove(state: GameState, move: Move): GameState {
  const s = cloneState(state);
  if (move.type === 'placement') {
    placeMarble(s, move.data.ringId, move.data.marbleColor);
    if (move.data.removedRingId) removeRing(s, move.data.removedRingId);
    else skipRingRemoval(s);
  } else {
    executeCapture(s, [move.data, ...(move.data.chain || [])]);
  }
  const winner = checkWinCondition(s);
  if (winner) { s.winner = winner; s.phase = 'gameOver'; }
  normalizePhase(s);
  return s;
}

function attachComment(node: GameNode, raw: string, labels: ZenLabels): void {
  const shapes: Shape[] = [];
  let text = raw
    .replace(/\[%cal\s+([^\]]*)\]/g, (_m, list: string) => { parseArrows(list, shapes, labels); return ''; })
    .replace(/\[%csl\s+([^\]]*)\]/g, (_m, list: string) => { parseCircles(list, shapes, labels); return ''; })
    .trim();
  if (text) node.comment = text;
  if (shapes.length) node.shapes = shapes;
}

function parseArrows(list: string, out: Shape[], labels: ZenLabels): void {
  for (const e of list.split(',').map(s => s.trim()).filter(Boolean)) {
    const m = e.match(/^([GRBY])([a-z]\d+)([a-z]\d+)$/);
    if (m) out.push({ brush: LETTER_TO_BRUSH[m[1]], orig: labels.toId(m[2]), dest: labels.toId(m[3]) });
  }
}

function parseCircles(list: string, out: Shape[], labels: ZenLabels): void {
  for (const e of list.split(',').map(s => s.trim()).filter(Boolean)) {
    const m = e.match(/^([GRBY])([a-z]\d+)$/);
    if (m) out.push({ brush: LETTER_TO_BRUSH[m[1]], orig: labels.toId(m[2]) });
  }
}

// ── tags + tokenizer ──

function splitTags(zen: string): { meta: ZenMeta; movetext: string } {
  const meta: ZenMeta = {};
  const lines = zen.split(/\r?\n/);
  let i = 0;
  for (; i < lines.length; i++) {
    const t = lines[i].match(/^\s*\[(\w+)\s+"([^"]*)"\]\s*$/);
    if (t) meta[t[1]] = t[2];
    else if (lines[i].trim() === '') continue;
    else break;
  }
  return { meta, movetext: lines.slice(i).join(' ') };
}

type Tok =
  | { type: 'MOVE'; value: string }
  | { type: 'COMMENT'; value: string }
  | { type: 'NUMBER' }
  | { type: 'LPAREN' }
  | { type: 'RPAREN' }
  | { type: 'RESULT'; value: string };

function tokenize(s: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '{') { const end = s.indexOf('}', i); const value = s.slice(i + 1, end < 0 ? s.length : end); toks.push({ type: 'COMMENT', value }); i = (end < 0 ? s.length : end + 1); continue; }
    if (ch === '(') { toks.push({ type: 'LPAREN' }); i++; continue; }
    if (ch === ')') { toks.push({ type: 'RPAREN' }); i++; continue; }
    let j = i;
    while (j < s.length && !/[\s(){}]/.test(s[j])) j++;
    let word = s.slice(i, j);
    i = j;
    const nm = word.match(/^\d+\.+/); // leading "12." / "12..." (glued or standalone)
    if (nm) { word = word.slice(nm[0].length); if (word === '') { toks.push({ type: 'NUMBER' }); continue; } }
    if (/^(1-0|0-1|\*)$/.test(word)) { toks.push({ type: 'RESULT', value: word }); continue; }
    toks.push({ type: 'MOVE', value: word });
  }
  return toks;
}
