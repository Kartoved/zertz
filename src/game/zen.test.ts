import { describe, it, expect } from 'vitest';
import { buildLabels, moveToZen, zenToMove, treeToZen, zenToTree } from './zen';
import {
  createInitialState, executeCapture, cloneState, placeMarble, removeRing, skipRingRemoval,
} from './GameEngine';
import { getValidRemovableRings, idToAlgebraic, coordToId } from './Board';
import { addMoveToTree, createRootNode, rebuildStateFromNodeWithStart } from '../utils/gameTreeUtils';
import { stateToZip } from './zip';
import { normalizePhase } from '../utils/moveActions';
import { GameNode, GameState, Move } from './types';

// Apply a structurally-valid move (mirrors zen.ts applyFullMove; legality beyond
// "ring is empty / removable" doesn't matter for serialization round-trips).
function apply(state: GameState, move: Move): GameState {
  const s = cloneState(state);
  if (move.type === 'placement') {
    placeMarble(s, move.data.ringId, move.data.marbleColor);
    if (move.data.removedRingId) removeRing(s, move.data.removedRingId);
    else skipRingRemoval(s);
  } else {
    executeCapture(s, [move.data, ...(move.data.chain || [])]);
  }
  normalizePhase(s);
  return s;
}

// A placement (+ removal) that applies cleanly at `state`, placing at a chosen
// empty ring so callers can steer the main line vs a variation apart.
function placementAt(state: GameState, emptyIndex: number): Move {
  const color = (['white', 'gray', 'black'] as const).find(c => state.reserve[c] > 0)!;
  const empties = [...state.rings.values()].filter(r => !r.isRemoved && !r.marble);
  const ringId = empties[emptyIndex].id;
  const sim = cloneState(state);
  placeMarble(sim, ringId, color);
  const removable = getValidRemovableRings(sim.rings);
  return { type: 'placement', data: { marbleColor: color, ringId, removedRingId: removable[0] ?? null } };
}

// Build a short linear main line of `plies` placement moves.
function linearGame(startState: GameState, plies: number): { root: GameNode; nodes: GameNode[] } {
  let state = cloneState(startState);
  const root = createRootNode();
  let node = root;
  const nodes: GameNode[] = [];
  for (let k = 0; k < plies; k++) {
    const move = placementAt(state, 0);
    node = addMoveToTree(node, move, state.currentPlayer, state.moveNumber, state.boardSize);
    nodes.push(node);
    state = apply(state, move);
  }
  return { root, nodes };
}

describe('ZEN intrinsic labels', () => {
  it('match the engine idToAlgebraic on standard full boards', () => {
    for (const size of [37, 48, 61] as const) {
      const s = createInitialState(size);
      const { toAlg, toId } = buildLabels(s);
      for (const ring of s.rings.values()) {
        expect(toAlg(ring.id)).toBe(idToAlgebraic(ring.id, size));
        expect(toId(toAlg(ring.id))).toBe(ring.id); // reverse round-trips
      }
    }
  });
});

describe('ZEN move emit', () => {
  const labels = buildLabels(createInitialState(37));

  it('placement', () => {
    const m: Move = { type: 'placement', data: { marbleColor: 'white', ringId: coordToId(0, 0), removedRingId: null } };
    expect(moveToZen(m, labels)).toBe('Wd7'); // (0,0) → d7
  });

  it('placement + ring removal', () => {
    const m: Move = { type: 'placement', data: { marbleColor: 'gray', ringId: coordToId(0, 0), removedRingId: coordToId(1, 0) } };
    expect(moveToZen(m, labels)).toBe('Gd7-e6');
  });

  it('capture chain with captured-color suffix', () => {
    const m: Move = {
      type: 'capture',
      data: {
        from: coordToId(0, 0), to: coordToId(0, 2), captured: coordToId(0, 1),
        marbleColor: 'white', capturedColor: 'black',
        chain: [{ from: coordToId(0, 2), to: coordToId(0, 4), captured: coordToId(0, 3), capturedColor: 'gray' }],
      },
    };
    expect(moveToZen(m, labels)).toBe('Wd7xd5xd3+bg');
  });
});

describe('ZEN move parse (round-trips structurally)', () => {
  const labels = buildLabels(createInitialState(37));

  it('placement', () => {
    const parsed = zenToMove('Wd7', labels);
    expect(parsed).toEqual({ type: 'placement', data: { marbleColor: 'white', ringId: coordToId(0, 0), removedRingId: null } });
  });

  it('placement + removal', () => {
    const parsed = zenToMove('Gd7-e6', labels);
    expect(parsed).toEqual({ type: 'placement', data: { marbleColor: 'gray', ringId: coordToId(0, 0), removedRingId: coordToId(1, 0) } });
  });

  it('capture chain (middle rings inferred; suffix ignored; × alias)', () => {
    const parsed = zenToMove('Wd7×d5×d3+bg', labels);
    expect(parsed.type).toBe('capture');
    if (parsed.type !== 'capture') return;
    expect(parsed.data.from).toBe(coordToId(0, 0));
    expect(parsed.data.to).toBe(coordToId(0, 2));
    expect(parsed.data.captured).toBe(coordToId(0, 1));
    expect(parsed.data.marbleColor).toBe('white');
    expect(parsed.data.chain).toEqual([
      { from: coordToId(0, 2), to: coordToId(0, 4), captured: coordToId(0, 3) },
    ]);
  });
});

describe('ZEN movetext (whole game)', () => {
  it('has tags + a [ZIP] start + numbered movetext + result', () => {
    const start = createInitialState(37);
    const { root } = linearGame(start, 4);
    const zen = treeToZen(start, root, { Player1: 'Alice', Player2: 'Bob', Result: '1-0' });
    expect(zen).toContain('[Player1 "Alice"]');
    expect(zen).toContain('[ZIP "');
    expect(zen).toMatch(/\n\n1\. /);   // movetext starts with move 1
    expect(zen.trimEnd().endsWith('1-0')).toBe(true);
  });

  it('handles a game with no moves yet (fresh board)', () => {
    const start = createInitialState(37);
    const zen = treeToZen(start, createRootNode(), { Result: '*' });
    expect(zen.trimEnd().endsWith('*')).toBe(true);
    const parsed = zenToTree(zen);
    expect(parsed.root.children.length).toBe(0);
    expect(treeToZen(parsed.startState, parsed.root, parsed.meta)).toBe(zen);
  });

  it('round-trips (treeToZen → zenToTree → treeToZen is stable)', () => {
    const start = createInitialState(37);
    const { root } = linearGame(start, 5);
    const meta = { Player1: 'A', Player2: 'B', Result: '*' };
    const s1 = treeToZen(start, root, meta);
    const parsed = zenToTree(s1);
    const s2 = treeToZen(parsed.startState, parsed.root, parsed.meta);
    expect(s2).toBe(s1);
  });

  it('preserves comments, annotations (shapes) and variations', () => {
    const start = createInitialState(37);
    const { root, nodes } = linearGame(start, 4);

    // Comment + annotation shapes on the 2nd move.
    nodes[1].comment = 'a key moment';
    nodes[1].shapes = [
      { orig: coordToId(0, 0), dest: coordToId(1, 0), brush: 'green' }, // arrow
      { orig: coordToId(-1, 3), brush: 'red' },                        // circle
    ];

    // A variation: an alternative first move (branch off root).
    let vState = cloneState(start);
    const altFirst = placementAt(vState, 2); // different empty ring than the main line
    const vNode = addMoveToTree(root, altFirst, vState.currentPlayer, vState.moveNumber, vState.boardSize);
    vState = apply(vState, altFirst);
    const altSecond = placementAt(vState, 3);
    addMoveToTree(vNode, altSecond, vState.currentPlayer, vState.moveNumber, vState.boardSize);

    const s1 = treeToZen(start, root, { Result: '*' });
    expect(s1).toContain('{');
    expect(s1).toContain('[%cal');
    expect(s1).toContain('[%csl');
    expect(s1).toContain('(');

    const parsed = zenToTree(s1);
    const n1 = parsed.root.children[0].children[0];
    expect(n1.comment).toBe('a key moment');

    // Shapes survive semantically. (Decoded states use relative coordinates, so
    // compare via algebraic labels rather than raw ring ids.)
    const orig = buildLabels(start);
    const now = buildLabels(parsed.startState);
    const asAlg = (labels: ReturnType<typeof buildLabels>, s: NonNullable<GameNode['shapes']>) =>
      s.map(sh => ({ brush: sh.brush, orig: labels.toAlg(sh.orig), dest: sh.dest ? labels.toAlg(sh.dest) : undefined }));
    expect(asAlg(now, n1.shapes!)).toEqual(asAlg(orig, nodes[1].shapes!));

    // variation survived (root has 2 children)
    expect(parsed.root.children.length).toBe(2);
    // full round-trip stable
    expect(treeToZen(parsed.startState, parsed.root, parsed.meta)).toBe(s1);
  });
});

describe('custom-start navigation (rebuildStateFromNodeWithStart)', () => {
  it('replays from a custom start — root reconstructs the start, not the standard board', () => {
    // Custom start: a marble already on the board, player 2 to move.
    const start = createInitialState(37);
    start.rings.get(coordToId(0, 0))!.marble = { color: 'white' };
    start.reserve = { white: 5, gray: 8, black: 10 };
    start.currentPlayer = 'player2';

    // Play one move off the custom start.
    const root = createRootNode();
    const move = placementAt(start, 0);
    const node = addMoveToTree(root, move, start.currentPlayer, start.moveNumber, start.boardSize);
    const afterMove = apply(start, move);

    // Navigating back to root must give the custom start, not createInitialState.
    expect(stateToZip(rebuildStateFromNodeWithStart(start, root))).toBe(stateToZip(start));
    // Navigating to the move node reproduces the played position.
    expect(stateToZip(rebuildStateFromNodeWithStart(start, node))).toBe(stateToZip(afterMove));
  });
});

describe('ZEN parse → apply is a legal engine move', () => {
  it('a parsed capture executes and records the captured marble', () => {
    // Set up a white marble at d7 (0,0) that can jump a black at d6 (0,1) to d5 (0,2).
    const s = createInitialState(37);
    s.rings.get(coordToId(0, 0))!.marble = { color: 'white' };
    s.rings.get(coordToId(0, 1))!.marble = { color: 'black' };
    // d5 (0,2) stays empty (landing square)
    const labels = buildLabels(s);

    const move = zenToMove('Wd7xd5', labels);
    expect(move.type).toBe('capture');
    if (move.type !== 'capture') return;

    const next = cloneState(s);
    executeCapture(next, [move.data, ...(move.data.chain || [])]);

    expect(next.rings.get(coordToId(0, 2))!.marble?.color).toBe('white'); // moved to landing
    expect(next.rings.get(coordToId(0, 0))!.marble).toBeNull();           // left origin
    expect(next.rings.get(coordToId(0, 1))!.marble).toBeNull();           // captured
    expect(next.captures.player1.black).toBe(1);
  });
});
