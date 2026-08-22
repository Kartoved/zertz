import { describe, it, expect } from 'vitest';
import { validateSetupState } from './validateSetup.js';
import { createInitialState } from './replay.js';

// Serialize a replay GameState the way apiClient.serializeState does (rings as
// an [id, ring] entry array).
function serialize(state) {
  return { ...state, rings: Array.from(state.rings.entries()) };
}

function validBase(size = 37) {
  return serialize(createInitialState(size));
}

describe('validateSetupState', () => {
  it('accepts the standard initial position', () => {
    expect(validateSetupState(validBase(37), 37)).toEqual({ ok: true });
    expect(validateSetupState(validBase(48), 48)).toEqual({ ok: true });
    expect(validateSetupState(validBase(61), 61)).toEqual({ ok: true });
  });

  it('accepts a JSON string form', () => {
    expect(validateSetupState(JSON.stringify(validBase(37)), 37)).toEqual({ ok: true });
  });

  it('accepts a rings Map directly', () => {
    const state = createInitialState(37);
    expect(validateSetupState(state, 37)).toEqual({ ok: true });
  });

  it('accepts a conserved mid-game position (marble on board, reserve decremented)', () => {
    const s = validBase(37);
    const [, ring] = s.rings[0];
    ring.marble = { color: 'white' };
    s.reserve.white -= 1; // moved from reserve to board — conserved
    expect(validateSetupState(s, 37)).toEqual({ ok: true });
  });

  it('rejects an invented marble (conservation break)', () => {
    const s = validBase(37);
    const [, ring] = s.rings[0];
    ring.marble = { color: 'white' }; // board +1 white without touching reserve
    const res = validateSetupState(s, 37);
    expect(res.ok).toBe(false);
    expect(res.reason).toContain('marble-conservation:white');
  });

  it('rejects a ring off the board template', () => {
    const s = validBase(37);
    s.rings.push(['999,999', { id: '999,999', q: 999, r: 999, marble: null, isRemoved: false }]);
    const res = validateSetupState(s, 37);
    expect(res.ok).toBe(false);
    expect(res.reason).toContain('off-board-ring');
  });

  it('rejects a mismatched ring set (missing a cell)', () => {
    const s = validBase(37);
    s.rings.pop();
    expect(validateSetupState(s, 37)).toEqual({ ok: false, reason: 'ring-set-mismatch' });
  });

  it('rejects a coord/id mismatch', () => {
    const s = validBase(37);
    s.rings[0][1].q += 1; // ring.q no longer matches its id
    const res = validateSetupState(s, 37);
    expect(res.ok).toBe(false);
    expect(res.reason).toContain('coord-id-mismatch');
  });

  it('rejects an already-won position', () => {
    const s = validBase(37);
    // Move 4 whites from reserve into player1 captures — conserved but decided.
    s.reserve.white -= 4;
    s.captures.player1.white += 4;
    expect(validateSetupState(s, 37)).toEqual({ ok: false, reason: 'already-won' });
  });

  it('rejects negative reserve counts', () => {
    const s = validBase(37);
    s.reserve.white = -1;
    expect(validateSetupState(s, 37)).toEqual({ ok: false, reason: 'bad-reserve' });
  });

  it('rejects a board with every ring removed', () => {
    const s = validBase(37);
    for (const [, ring] of s.rings) ring.isRemoved = true;
    // Removing all rings also loses no marbles (board was empty) — conservation ok,
    // but there is nothing to play.
    expect(validateSetupState(s, 37)).toEqual({ ok: false, reason: 'no-playable-ring' });
  });

  it('rejects a bad current player', () => {
    const s = validBase(37);
    s.currentPlayer = 'player3';
    expect(validateSetupState(s, 37)).toEqual({ ok: false, reason: 'bad-current-player' });
  });

  it('rejects a bad board size', () => {
    expect(validateSetupState(validBase(37), 42)).toEqual({ ok: false, reason: 'bad-board-size' });
  });

  it('rejects malformed JSON', () => {
    expect(validateSetupState('{not json', 37)).toEqual({ ok: false, reason: 'bad-json' });
  });
});
