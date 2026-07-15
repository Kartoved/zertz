import { describe, it, expect } from 'vitest';
import { stateToZip, zipToState } from './zip';
import { createInitialState } from './GameEngine';
import { coordToId } from './Board';
import { GameState, MarbleColor } from './types';

function setMarble(state: GameState, id: string, color: MarbleColor | null) {
  const ring = state.rings.get(id)!;
  ring.marble = color ? { color } : null;
}

describe('ZIP encode', () => {
  it('encodes the initial 37 board with the expected layout + fields', () => {
    const s = createInitialState(37);
    expect(stateToZip(s)).toBe(
      'oooo/ooooo/oooooo/ooooooo/1oooooo/2ooooo/3oooo 6/8/10 0/0/0 0/0/0 1'
    );
  });

  it('reflects marbles, pool, captures and side to move', () => {
    const s = createInitialState(37);
    setMarble(s, coordToId(0, 0), 'white'); // a marble somewhere
    s.reserve = { white: 5, gray: 8, black: 10 };
    s.captures.player1 = { white: 1, gray: 0, black: 2 };
    s.captures.player2 = { white: 0, gray: 3, black: 0 };
    s.currentPlayer = 'player2';
    const zip = stateToZip(s);
    const fields = zip.split(' ');
    expect(fields[1]).toBe('5/8/10');
    expect(fields[2]).toBe('1/0/2');
    expect(fields[3]).toBe('0/3/0');
    expect(fields[4]).toBe('2');
    expect(zip).toContain('W'); // the placed marble appears
  });
});

describe('ZIP round-trip (encode → decode → encode is stable)', () => {
  const roundtrips = (s: GameState) => {
    const a = stateToZip(s);
    const b = stateToZip(zipToState(a));
    expect(b).toBe(a);
  };

  it('initial boards of every size', () => {
    roundtrips(createInitialState(37));
    roundtrips(createInitialState(48));
    roundtrips(createInitialState(61));
  });

  it('with marbles, pool and captures set', () => {
    const s = createInitialState(48);
    setMarble(s, coordToId(0, 0), 'white');
    setMarble(s, coordToId(1, 0), 'gray');
    setMarble(s, coordToId(-1, 3), 'black');
    s.reserve = { white: 3, gray: 4, black: 9 };
    s.captures.player1 = { white: 2, gray: 1, black: 0 };
    s.currentPlayer = 'player2';
    roundtrips(s);
  });

  it('with removed rings (internal gaps + edge removal)', () => {
    const s = createInitialState(37);
    // Remove an interior ring (creates an internal hole) and an edge ring.
    s.rings.get(coordToId(0, 3))!.isRemoved = true;
    s.rings.get(coordToId(-3, 6))!.isRemoved = true; // a1 corner
    roundtrips(s);
  });
});

describe('ZIP decode', () => {
  it('recovers pool, captures and side', () => {
    const zip = 'oooo/ooooo/oooooo/ooooooo/1oooooo/2ooooo/3oooo 4/2/7 1/1/1 0/2/3 2';
    const s = zipToState(zip);
    expect(s.reserve).toEqual({ white: 4, gray: 2, black: 7 });
    expect(s.captures.player1).toEqual({ white: 1, gray: 1, black: 1 });
    expect(s.captures.player2).toEqual({ white: 0, gray: 2, black: 3 });
    expect(s.currentPlayer).toBe('player2');
  });

  it('recovers the right number of present rings and marble', () => {
    const zip = stateToZip((() => {
      const s = createInitialState(37);
      setMarble(s, coordToId(0, 0), 'black');
      return s;
    })());
    const s = zipToState(zip);
    const present = [...s.rings.values()].filter(r => !r.isRemoved);
    expect(present.length).toBe(37);
    expect(present.filter(r => r.marble?.color === 'black').length).toBe(1);
  });

  it('reads an RLE hole run correctly (2ooWo = 2 holes, empty, empty, white, empty)', () => {
    // single column, isolated — just exercise the column parser via a full ZIP
    const s = zipToState('2ooWo 6/8/10 0/0/0 0/0/0 1');
    const present = [...s.rings.values()].filter(r => !r.isRemoved);
    expect(present.length).toBe(4); // o,o,W,o
    expect(present.filter(r => r.marble?.color === 'white').length).toBe(1);
  });
});
