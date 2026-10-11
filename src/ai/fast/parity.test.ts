/**
 * The fast engine against the production one, ply by ply.
 *
 * This is a third implementation of the rules, so it is only safe while
 * something proves they agree. Random games are played with the PRODUCTION
 * engine choosing every move, and after each ply both the position AND what
 * each engine believes is legal are compared — a representation that reaches
 * the right position by the wrong route would still ruin a search.
 */

import { describe, it, expect } from 'vitest';
import { createInitialState, hasAvailableCaptures } from '../../game/GameEngine';
import { getValidRemovableRings } from '../../game/Board';
import { GameState, MarbleColor } from '../../game/types';
import { BotMove, applyBotMove, applyBotMoveDetailed, captureMoves, generateAllMoves, placeableColors as slowColors } from '../apply';
import { safeRandomBot } from '../bots';
import { rng } from '../arena';
import { REMOVED, colorOf, isMarble } from './board';
import { COLOR_NAMES, FastState, NO_WINNER, fromGameState } from './state';
import {
  applyCapture, applyPlacement, captureSequences, emptyCells, hasAnyLegalMove, hasCaptures,
  placeableColors, removableCells,
} from './rules';

function expectSamePosition(slow: GameState, fast: FastState, where: string): void {
  for (let i = 0; i < fast.geo.n; i++) {
    const ring = slow.rings.get(fast.geo.ids[i])!;
    const slowDesc = ring.isRemoved ? '-' : ring.marble ? ring.marble.color : '.';
    const cell = fast.cells[i];
    const fastDesc = cell === REMOVED ? '-' : isMarble(cell) ? COLOR_NAMES[colorOf(cell)] : '.';
    expect(fastDesc, `${where}: ring ${fast.geo.ids[i]}`).toBe(slowDesc);
  }
  expect([...fast.pool], `${where}: pool`).toEqual(COLOR_NAMES.map(c => slow.reserve[c]));
  expect([...fast.captures], `${where}: captures`).toEqual(
    [...COLOR_NAMES.map(c => slow.captures.player1[c]), ...COLOR_NAMES.map(c => slow.captures.player2[c])]);
  expect(fast.side === 0 ? 'player1' : 'player2', `${where}: side`).toBe(slow.currentPlayer);
  expect(fast.moveNumber, `${where}: move number`).toBe(slow.moveNumber);
  expect(fast.winner === NO_WINNER ? null : fast.winner === 0 ? 'player1' : 'player2', `${where}: winner`)
    .toBe(slow.winner ?? null);
}

const chainKey = (ids: string[], steps: Array<{ from: number; over: number; to: number }>) =>
  steps.map(j => `${ids[j.from]}>${ids[j.over]}>${ids[j.to]}`).join('|');

function expectSameLegality(slow: GameState, fast: FastState, where: string): void {
  const ids = fast.geo.ids;
  expect(hasCaptures(fast), `${where}: capture availability`).toBe(hasAvailableCaptures(slow));
  expect(hasAnyLegalMove(fast), `${where}: any legal move`).toBe(generateAllMoves(slow).length > 0);
  expect(removableCells(fast).map(c => ids[c]).sort(), `${where}: removable rings`)
    .toEqual(getValidRemovableRings(slow.rings).sort());
  expect(emptyCells(fast).map(c => ids[c]).sort(), `${where}: empty rings`)
    .toEqual([...slow.rings.values()].filter(r => !r.isRemoved && !r.marble).map(r => r.id).sort());
  expect(placeableColors(fast).map(c => COLOR_NAMES[c]), `${where}: placeable colours`).toEqual(slowColors(slow));
  if (hasAvailableCaptures(slow)) {
    const slowChains = captureMoves(slow).map(m => m.type === 'capture'
      ? m.chain.map(j => `${j.from}>${j.captured}>${j.to}`).join('|') : '').sort();
    const fastChains = captureSequences(fast).map(seq => chainKey(ids, seq)).sort();
    expect(fastChains, `${where}: capture chains`).toEqual(slowChains);
  }
}

/** Applies the production engine's chosen move to the fast state. */
function applyToFast(fast: FastState, move: BotMove): void {
  const { index } = fast.geo;
  if (move.type === 'capture') {
    const key = move.chain.map(j => `${j.from}>${j.captured}>${j.to}`).join('|');
    const seq = captureSequences(fast).find(s => chainKey(fast.geo.ids, s) === key);
    expect(seq, `chain ${key} present in the fast engine`).toBeDefined();
    applyCapture(fast, seq!);
  } else {
    applyPlacement(
      fast, index.get(move.ringId)!, COLOR_NAMES.indexOf(move.color as MarbleColor),
      move.removedRingId ? index.get(move.removedRingId)! : -1,
    );
  }
}

function playInLockstep(size: 37 | 48 | 61, seed: number, start: GameState = createInitialState(size)): number {
  const rand = rng(seed);
  let slow = start;
  const fast = fromGameState(slow);
  for (let ply = 0; ply < 300; ply++) {
    const where = `${size} seed ${seed} ply ${ply}`;
    expectSamePosition(slow, fast, where);
    expectSameLegality(slow, fast, where);
    const moves = generateAllMoves(slow);
    if (moves.length === 0) return ply;
    const move = moves[Math.floor(rand() * moves.length)];
    slow = applyBotMove(slow, move);
    applyToFast(fast, move);
  }
  return 300;
}

describe('fast engine parity with the production engine', () => {
  it('agrees on position and legality through whole random games on every board', () => {
    for (const size of [37, 48, 61] as const) {
      for (let seed = 1; seed <= 12; seed++) expect(playInLockstep(size, seed)).toBeGreaterThan(4);
    }
  });

  it('agrees in long, cramped games where groups get cut off and filled', () => {
    // Games that avoid handing over captures run long, run the pool dry and
    // split the board — where isolation and the full-board rule live.
    let isolations = 0;
    for (const size of [37, 48] as const) {
      for (let seed = 100; seed <= 115; seed++) {
        const rand = rng(seed);
        let slow = createInitialState(size);
        const fast = fromGameState(slow);
        for (let ply = 0; ply < 300; ply++) {
          const where = `quiet ${size} seed ${seed} ply ${ply}`;
          expectSamePosition(slow, fast, where);
          expectSameLegality(slow, fast, where);
          const move = safeRandomBot.pickMove(slow, slow.currentPlayer, rand);
          if (!move) break;
          const { state, isolated } = applyBotMoveDetailed(slow, move);
          if (isolated.length) isolations++;
          slow = state;
          applyToFast(fast, move);
        }
      }
    }
    // Guard the guard: these games must keep reaching isolation captures.
    expect(isolations).toBeGreaterThan(10);
  });

  it('agrees on a placement that fills the whole board and one that fills a cut-off group', () => {
    const boardOf = (keep: Record<string, MarbleColor | null>) => {
      const state = createInitialState(37);
      for (const [id, ring] of state.rings) {
        if (id in keep) ring.marble = keep[id] ? { color: keep[id]! } : null;
        else ring.isRemoved = true;
      }
      return state;
    };
    const cases: Array<[GameState, BotMove]> = [
      [boardOf({ '0,3': 'white', '1,3': 'gray', '2,3': 'black', '3,3': null }),
        { type: 'placement', ringId: '3,3', color: 'gray', removedRingId: null }],
      [boardOf({ '0,0': 'white', '1,0': null, '0,3': null, '1,3': 'black', '1,2': 'black', '0,2': 'gray', '-1,3': 'gray', '-1,4': 'black', '0,4': 'black' }),
        { type: 'placement', ringId: '1,0', color: 'white', removedRingId: null }],
    ];
    for (const [start, move] of cases) {
      const fast = fromGameState(start);
      applyToFast(fast, move);
      expectSamePosition(applyBotMove(start, move), fast, `seeded ${move.type === 'placement' ? move.ringId : ''}`);
    }
  });
});
