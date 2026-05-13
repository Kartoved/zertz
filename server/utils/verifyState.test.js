import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  applyMove,
  normalizePhase,
} from '../../shared/explorer/replay.js';
import { verifySubmittedState } from './verifyState.js';

// Tiny helper to serialize state in the same shape as apiClient.serializeState.
function serializeState(state) {
  return JSON.stringify({ ...state, rings: Array.from(state.rings.entries()) });
}

function makeTreeWithMoves(moves) {
  const root = { id: 'root', moveNumber: 0, move: null, notation: '', children: [], parent: null, isMainLine: true };
  let parent = root;
  for (let i = 0; i < moves.length; i++) {
    const node = {
      id: `n-${i}`,
      moveNumber: i + 1,
      move: moves[i],
      notation: '',
      children: [],
      parent: null,
      isMainLine: true,
    };
    parent.children.push(node);
    parent = node;
  }
  return root;
}

describe('verifySubmittedState', () => {
  it('accepts a freshly replayed state from a one-move tree', () => {
    const boardSize = 37;
    const move = { type: 'placement', data: { marbleColor: 'white', ringId: '0,3', removedRingId: '0,0' } };

    const state = createInitialState(boardSize);
    applyMove(state, move);
    normalizePhase(state);

    const result = verifySubmittedState({
      stateJson: serializeState(state),
      treeJson: JSON.stringify(makeTreeWithMoves([move])),
      boardSize,
      winType: null,
      playerIndex: 1,
    });

    expect(result).toEqual({ ok: true });
  });

  it('rejects when client claims extra captures', () => {
    const boardSize = 37;
    const move = { type: 'placement', data: { marbleColor: 'white', ringId: '0,3', removedRingId: '0,0' } };

    const state = createInitialState(boardSize);
    applyMove(state, move);
    normalizePhase(state);

    // Tamper: pretend we captured 3 whites.
    state.captures.player1.white = 3;

    const result = verifySubmittedState({
      stateJson: serializeState(state),
      treeJson: JSON.stringify(makeTreeWithMoves([move])),
      boardSize,
      winType: null,
      playerIndex: 1,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/captures/);
  });

  it('rejects when client claims winner without supporting captures', () => {
    const boardSize = 37;
    const move = { type: 'placement', data: { marbleColor: 'white', ringId: '0,3', removedRingId: '0,0' } };

    const state = createInitialState(boardSize);
    applyMove(state, move);
    normalizePhase(state);

    state.winner = 'player1';

    const result = verifySubmittedState({
      stateJson: serializeState(state),
      treeJson: JSON.stringify(makeTreeWithMoves([move])),
      boardSize,
      winType: 'white',
      playerIndex: 1,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('winner-mismatch');
  });

  it('accepts surrender that credits the opponent', () => {
    const boardSize = 37;
    const move = { type: 'placement', data: { marbleColor: 'white', ringId: '0,3', removedRingId: '0,0' } };

    const state = createInitialState(boardSize);
    applyMove(state, move);
    normalizePhase(state);
    state.winner = 'player2';

    const result = verifySubmittedState({
      stateJson: serializeState(state),
      treeJson: JSON.stringify(makeTreeWithMoves([move])),
      boardSize,
      winType: 'surrender',
      playerIndex: 1,
    });

    expect(result.ok).toBe(true);
  });

  it('rejects surrender that tries to credit the submitter as winner', () => {
    const boardSize = 37;
    const state = createInitialState(boardSize);
    state.winner = 'player1';

    const result = verifySubmittedState({
      stateJson: serializeState(state),
      treeJson: JSON.stringify(makeTreeWithMoves([])),
      boardSize,
      winType: 'surrender',
      playerIndex: 1, // submitter is player1, can't credit themselves
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('surrender-must-credit-opponent');
  });

  it('skips deep verification on intermediate placement (pendingPlacement set)', () => {
    const boardSize = 37;
    // Build state mid-placement: marble placed, awaiting ring removal.
    const state = createInitialState(boardSize);
    const ring = state.rings.get('0,3');
    ring.marble = { color: 'white' };
    state.reserve.white--;
    state.pendingPlacement = { ringId: '0,3', marbleColor: 'white' };
    state.phase = 'ringRemoval';

    // Tree is empty — no completed move yet. Deep verify would fail, but
    // pendingPlacement should short-circuit.
    const result = verifySubmittedState({
      stateJson: serializeState(state),
      treeJson: JSON.stringify(makeTreeWithMoves([])),
      boardSize,
      winType: null,
      playerIndex: 1,
    });

    expect(result.ok).toBe(true);
  });
});
