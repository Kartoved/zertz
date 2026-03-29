import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInitialState,
  cloneState,
  placeMarble,
  removeRing,
  skipRingRemoval,
  executeCapture,
  getAvailableCaptures,
  getCaptureChains,
  checkWinCondition,
  hasAvailableCaptures,
} from './GameEngine';
import { getValidRemovableRings } from './Board';
import { GameState } from './types';

// Helper: complete a full placement turn (place marble + remove any free ring)
function completeTurn(state: GameState, ringId: string, color: 'white' | 'gray' | 'black'): void {
  const placed = placeMarble(state, ringId, color);
  if (!placed) throw new Error(`Failed to place ${color} at ${ringId}`);
  const freeRings = getValidRemovableRings(state.rings);
  if (freeRings.length > 0) {
    removeRing(state, freeRings[0]);
  } else {
    skipRingRemoval(state);
  }
}

// ─── createInitialState ───────────────────────────────────────────────────────

describe('createInitialState', () => {
  it('creates 37-ring board with correct ring count', () => {
    expect(createInitialState(37).rings.size).toBe(37);
  });

  it('creates 48-ring board', () => {
    expect(createInitialState(48).rings.size).toBe(48);
  });

  it('creates 61-ring board', () => {
    expect(createInitialState(61).rings.size).toBe(61);
  });

  it('starts with correct reserve (6w 8g 10b)', () => {
    const state = createInitialState();
    expect(state.reserve).toEqual({ white: 6, gray: 8, black: 10 });
  });

  it('starts with player1 in placement phase', () => {
    const state = createInitialState();
    expect(state.currentPlayer).toBe('player1');
    expect(state.phase).toBe('placement');
  });

  it('starts with empty captures for both players', () => {
    const state = createInitialState();
    expect(state.captures.player1).toEqual({ white: 0, gray: 0, black: 0 });
    expect(state.captures.player2).toEqual({ white: 0, gray: 0, black: 0 });
  });

  it('all rings start without marbles and not removed', () => {
    const state = createInitialState();
    for (const ring of state.rings.values()) {
      expect(ring.marble).toBeNull();
      expect(ring.isRemoved).toBe(false);
    }
  });
});

// ─── cloneState ──────────────────────────────────────────────────────────────

describe('cloneState', () => {
  it('produces a deep copy — mutating clone does not affect original', () => {
    const original = createInitialState();
    const clone = cloneState(original);
    clone.rings.get('0,0')!.marble = { color: 'white' };
    clone.reserve.white = 0;
    clone.captures.player1.white = 5;
    expect(original.rings.get('0,0')!.marble).toBeNull();
    expect(original.reserve.white).toBe(6);
    expect(original.captures.player1.white).toBe(0);
  });
});

// ─── placeMarble ─────────────────────────────────────────────────────────────

describe('placeMarble', () => {
  let state: GameState;
  beforeEach(() => { state = createInitialState(); });

  it('returns true and places marble on empty ring', () => {
    expect(placeMarble(state, '0,0', 'white')).toBe(true);
    expect(state.rings.get('0,0')!.marble).toEqual({ color: 'white' });
  });

  it('decrements reserve by 1', () => {
    placeMarble(state, '0,0', 'white');
    expect(state.reserve.white).toBe(5);
  });

  it('changes phase to ringRemoval', () => {
    placeMarble(state, '0,0', 'white');
    expect(state.phase).toBe('ringRemoval');
  });

  it('sets pendingPlacement', () => {
    placeMarble(state, '0,0', 'white');
    expect(state.pendingPlacement).toEqual({ ringId: '0,0', marbleColor: 'white' });
  });

  it('returns false when placing on occupied ring', () => {
    state.rings.get('0,0')!.marble = { color: 'gray' };
    expect(placeMarble(state, '0,0', 'white')).toBe(false);
  });

  it('returns false when placing on removed ring', () => {
    state.rings.get('0,0')!.isRemoved = true;
    expect(placeMarble(state, '0,0', 'white')).toBe(false);
  });

  it('returns false when color not in reserve', () => {
    state.reserve.white = 0;
    expect(placeMarble(state, '0,0', 'white')).toBe(false);
  });

  it('draws from player captures when reserve is empty', () => {
    state.reserve = { white: 0, gray: 0, black: 0 };
    state.captures.player1.white = 2;
    expect(placeMarble(state, '0,0', 'white')).toBe(true);
    expect(state.captures.player1.white).toBe(1);
  });
});

// ─── removeRing ──────────────────────────────────────────────────────────────

describe('removeRing', () => {
  let state: GameState;
  beforeEach(() => {
    state = createInitialState();
    // Place marble in center area so corner rings stay free to remove
    placeMarble(state, '0,3', 'white');
  });

  it('removes a valid free corner ring', () => {
    expect(removeRing(state, '3,0')).toBe(true);
    expect(state.rings.get('3,0')!.isRemoved).toBe(true);
  });

  it('switches current player', () => {
    removeRing(state, '3,0');
    expect(state.currentPlayer).toBe('player2');
  });

  it('increments moveNumber', () => {
    removeRing(state, '3,0');
    expect(state.moveNumber).toBe(2);
  });

  it('resets phase to placement', () => {
    removeRing(state, '3,0');
    expect(state.phase).toBe('placement');
  });

  it('clears pendingPlacement', () => {
    removeRing(state, '3,0');
    expect(state.pendingPlacement).toBeNull();
  });

  it('returns false for ring with marble', () => {
    // "0,3" has a marble from beforeEach
    expect(removeRing(state, '0,3')).toBe(false);
  });

  it('returns false for a ring that is not free (interior ring with all neighbors)', () => {
    // "0,1" in a full board is surrounded on most sides — not a free ring initially
    expect(removeRing(state, '0,1')).toBe(false);
  });
});

// ─── skipRingRemoval ─────────────────────────────────────────────────────────

describe('skipRingRemoval', () => {
  it('skips turn when no valid rings to remove', () => {
    const state = createInitialState();
    placeMarble(state, '0,0', 'white');

    // Fill all remaining empty rings with marbles so no ring is free
    for (const [, ring] of state.rings) {
      if (!ring.marble && !ring.isRemoved) {
        ring.marble = { color: 'gray' };
      }
    }

    const prevPlayer = state.currentPlayer;
    const prevMove = state.moveNumber;
    skipRingRemoval(state);
    expect(state.currentPlayer).not.toBe(prevPlayer);
    expect(state.moveNumber).toBe(prevMove + 1);
    expect(state.phase).toBe('placement');
  });

  it('does not skip when valid removable rings exist', () => {
    const state = createInitialState();
    placeMarble(state, '0,0', 'white');
    const prevPlayer = state.currentPlayer;
    skipRingRemoval(state); // free rings exist → should not skip
    expect(state.currentPlayer).toBe(prevPlayer);
    expect(state.phase).toBe('ringRemoval');
  });
});

// ─── getAvailableCaptures ─────────────────────────────────────────────────────

describe('getAvailableCaptures', () => {
  it('returns empty array on fresh board (no marbles)', () => {
    const state = createInitialState();
    expect(getAvailableCaptures(state)).toHaveLength(0);
  });

  it('detects a single valid capture', () => {
    const state = createInitialState();
    // white at "0,0", gray at "1,0", "2,0" empty → white can jump over gray
    state.rings.get('0,0')!.marble = { color: 'white' };
    state.rings.get('1,0')!.marble = { color: 'gray' };

    const captures = getAvailableCaptures(state);
    expect(captures.some(c => c.from === '0,0' && c.to === '2,0' && c.captured === '1,0')).toBe(true);
  });

  it('does not generate capture when landing ring is occupied', () => {
    const state = createInitialState();
    state.rings.get('0,0')!.marble = { color: 'white' };
    state.rings.get('1,0')!.marble = { color: 'gray' };
    state.rings.get('2,0')!.marble = { color: 'black' };

    expect(captures => captures.some((c: any) => c.from === '0,0' && c.to === '2,0')).toBeDefined();
    expect(getAvailableCaptures(state).some(c => c.from === '0,0' && c.to === '2,0')).toBe(false);
  });

  it('does not generate capture when no adjacent marble', () => {
    const state = createInitialState();
    state.rings.get('0,0')!.marble = { color: 'white' };
    expect(getAvailableCaptures(state)).toHaveLength(0);
  });
});

// ─── hasAvailableCaptures ────────────────────────────────────────────────────

describe('hasAvailableCaptures', () => {
  it('returns false on empty board', () => {
    expect(hasAvailableCaptures(createInitialState())).toBe(false);
  });

  it('returns true when capture exists', () => {
    const state = createInitialState();
    state.rings.get('0,0')!.marble = { color: 'white' };
    state.rings.get('1,0')!.marble = { color: 'gray' };
    expect(hasAvailableCaptures(state)).toBe(true);
  });
});

// ─── executeCapture ───────────────────────────────────────────────────────────

describe('executeCapture', () => {
  function setupCapture() {
    const state = createInitialState();
    state.rings.get('0,0')!.marble = { color: 'white' };
    state.rings.get('1,0')!.marble = { color: 'gray' };
    const captures = getAvailableCaptures(state);
    const capture = captures.find(c => c.from === '0,0' && c.to === '2,0')!;
    return { state, capture };
  }

  it('moves marble from source to destination', () => {
    const { state, capture } = setupCapture();
    executeCapture(state, [capture]);
    expect(state.rings.get('0,0')!.marble).toBeNull();
    expect(state.rings.get('2,0')!.marble).toEqual({ color: 'white' });
  });

  it('removes captured marble from board', () => {
    const { state, capture } = setupCapture();
    executeCapture(state, [capture]);
    expect(state.rings.get('1,0')!.marble).toBeNull();
  });

  it('increments captures count for current player', () => {
    const { state, capture } = setupCapture();
    executeCapture(state, [capture]);
    expect(state.captures.player1.gray).toBe(1);
  });

  it('switches current player', () => {
    const { state, capture } = setupCapture();
    executeCapture(state, [capture]);
    expect(state.currentPlayer).toBe('player2');
  });

  it('increments moveNumber', () => {
    const { state, capture } = setupCapture();
    executeCapture(state, [capture]);
    expect(state.moveNumber).toBe(2);
  });
});

// ─── getCaptureChains ─────────────────────────────────────────────────────────

describe('getCaptureChains', () => {
  it('returns empty for ring without marble', () => {
    const state = createInitialState();
    expect(getCaptureChains(state, '0,0')).toHaveLength(0);
  });

  it('returns one chain for a single capture', () => {
    const state = createInitialState();
    state.rings.get('0,0')!.marble = { color: 'white' };
    state.rings.get('1,0')!.marble = { color: 'gray' };

    const chains = getCaptureChains(state, '0,0');
    expect(chains).toHaveLength(1);
    expect(chains[0]).toHaveLength(1);
    expect(chains[0][0].from).toBe('0,0');
    expect(chains[0][0].to).toBe('2,0');
  });

  it('returns multi-step chain when second capture is available', () => {
    const state = createInitialState();
    // Chain: white "-3,3" → jumps gray "-2,3" → lands "-1,3" → jumps black "0,3" → lands "1,3"
    state.rings.get('-3,3')!.marble = { color: 'white' };
    state.rings.get('-2,3')!.marble = { color: 'gray' };
    // "-1,3" is empty (first landing)
    state.rings.get('0,3')!.marble = { color: 'black' };
    // "1,3" is empty (second landing)

    const chains = getCaptureChains(state, '-3,3');
    const twoStepChain = chains.find(chain => chain.length === 2);
    expect(twoStepChain).toBeDefined();
    expect(twoStepChain![0].from).toBe('-3,3');
    expect(twoStepChain![0].to).toBe('-1,3');
    expect(twoStepChain![1].from).toBe('-1,3');
    expect(twoStepChain![1].to).toBe('1,3');
  });
});

// ─── checkWinCondition ───────────────────────────────────────────────────────

describe('checkWinCondition', () => {
  it('returns null at game start', () => {
    expect(checkWinCondition(createInitialState())).toBeNull();
  });

  it('detects win by 4 white marbles', () => {
    const state = createInitialState();
    state.captures.player1.white = 4;
    expect(checkWinCondition(state)).toBe('player1');
  });

  it('detects win by 5 gray marbles', () => {
    const state = createInitialState();
    state.captures.player2.gray = 5;
    expect(checkWinCondition(state)).toBe('player2');
  });

  it('detects win by 6 black marbles', () => {
    const state = createInitialState();
    state.captures.player1.black = 6;
    expect(checkWinCondition(state)).toBe('player1');
  });

  it('detects win by 3 of each color (mixed)', () => {
    const state = createInitialState();
    state.captures.player2 = { white: 3, gray: 3, black: 3 };
    expect(checkWinCondition(state)).toBe('player2');
  });

  it('does NOT win with exactly 3 white only', () => {
    const state = createInitialState();
    state.captures.player1.white = 3;
    expect(checkWinCondition(state)).toBeNull();
  });

  it('does NOT win with 2 of each color', () => {
    const state = createInitialState();
    state.captures.player1 = { white: 2, gray: 2, black: 2 };
    expect(checkWinCondition(state)).toBeNull();
  });

  it('player1 wins before player2 even if both meet conditions', () => {
    const state = createInitialState();
    state.captures.player1.white = 4;
    state.captures.player2.white = 4;
    expect(checkWinCondition(state)).toBe('player1');
  });
});

// ─── isolation auto-capture ──────────────────────────────────────────────────

describe('isolation auto-capture', () => {
  it('auto-captures a fully-filled isolated group on ring removal', () => {
    const state = createInitialState();

    // Place white marble on corner "3,0" (its neighbors: "2,0", "2,1", "3,1")
    state.rings.get('3,0')!.marble = { color: 'white' };
    // Remove all neighbors of "3,0" to isolate it
    state.rings.get('2,0')!.isRemoved = true;
    state.rings.get('2,1')!.isRemoved = true;
    state.rings.get('3,1')!.isRemoved = true;

    // Put state in ringRemoval phase by placing elsewhere
    placeMarble(state, '-3,6', 'gray');
    // Remove a safe corner ring far from the isolated area
    expect(removeRing(state, '0,6')).toBe(true);

    // "3,0" should have been auto-captured for player1
    expect(state.rings.get('3,0')!.marble).toBeNull();
    expect(state.captures.player1.white).toBe(1);
  });

  it('does NOT auto-capture isolated group that still has empty rings', () => {
    const state = createInitialState();

    // Isolate a 2-ring group {"3,0", "2,0"} where only "3,0" has a marble
    // Remove all connections from this 2-ring group to the rest of the board:
    // "2,0" connects via "1,0"(W), "1,1"(SW), "2,1"(SE) — remove all three
    // "3,0" connects via "3,1"(SE), "2,1"(SW) — "2,1" already removed, remove "3,1"
    state.rings.get('1,0')!.isRemoved = true;
    state.rings.get('1,1')!.isRemoved = true;
    state.rings.get('2,1')!.isRemoved = true;
    state.rings.get('3,1')!.isRemoved = true;

    // Place marble only on "3,0"; "2,0" stays empty → group has an empty ring
    state.rings.get('3,0')!.marble = { color: 'white' };

    // Trigger handleIsolation by placing + removing elsewhere
    placeMarble(state, '-3,6', 'gray');
    // Use an explicit safe ring to remove (opposite corner, unaffected by our setup)
    expect(removeRing(state, '0,6')).toBe(true);

    // "3,0" marble should NOT be captured — the group {"2,0", "3,0"} has empty "2,0"
    expect(state.rings.get('3,0')!.marble).not.toBeNull();
    expect(state.captures.player1.white).toBe(0);
  });
});

// ─── full game sequence ───────────────────────────────────────────────────────

describe('full game sequence', () => {
  it('alternates players correctly across multiple turns', () => {
    const state = createInitialState();
    expect(state.currentPlayer).toBe('player1');

    // Use interior rings (fully surrounded) to avoid accidental removal conflicts
    completeTurn(state, '0,3', 'white');
    expect(state.currentPlayer).toBe('player2');

    completeTurn(state, '-1,3', 'gray');
    expect(state.currentPlayer).toBe('player1');

    completeTurn(state, '1,3', 'black');
    expect(state.currentPlayer).toBe('player2');
  });

  it('increments moveNumber after each completed turn', () => {
    const state = createInitialState();
    expect(state.moveNumber).toBe(1);

    completeTurn(state, '0,3', 'white');
    expect(state.moveNumber).toBe(2);

    completeTurn(state, '-1,3', 'gray');
    expect(state.moveNumber).toBe(3);
  });

  it('mandatory capture: hasAvailableCaptures returns true when capture exists', () => {
    const state = createInitialState();
    state.rings.get('0,0')!.marble = { color: 'white' };
    state.rings.get('1,0')!.marble = { color: 'gray' };
    // When captures are available, placement should be blocked (enforced by UI/store)
    expect(hasAvailableCaptures(state)).toBe(true);
  });
});
