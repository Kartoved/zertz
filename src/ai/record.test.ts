import { describe, it, expect } from 'vitest';
import { zenToTree } from '../game/zen';
import { stateToZip } from '../game/zip';
import { rebuildStateFromNodeWithStart, findDeepestMainLine } from '../utils/gameTreeUtils';
import { BotMove, applyBotMove } from './apply';
import { openingState, playMatchGame, rng, summarizeMatch } from './arena';
import { randomBot, safeRandomBot } from './bots';
import { recordGame } from './record';
import { BOOK_48 } from './positions/book48';

describe('a recorded bot game', () => {
  it('replays from its ZEN to the same final position', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const rand = rng(seed);
      const start = openingState(48, BOOK_48[seed]);
      let state = start;
      const moves: BotMove[] = [];
      while (!state.winner) {
        const move = randomBot.pickMove(state, state.currentPlayer, rand);
        if (!move) break;
        moves.push(move);
        state = applyBotMove(state, move);
      }

      const recorded = recordGame(start, moves, { Result: '*' });
      const { startState, root } = zenToTree(recorded.zen);
      const replayed = rebuildStateFromNodeWithStart(startState, findDeepestMainLine(root));
      // ZIP describes the geometry relative to itself, so it compares positions
      // even if the start was re-anchored on read.
      expect(stateToZip(replayed), `seed ${seed}`).toBe(stateToZip(recorded.final));
      expect(replayed.captures).toEqual(recorded.final.captures);
    }
  });
});

describe('the arena', () => {
  it('plays the same match again from the same seeds', () => {
    const run = () => Array.from({ length: 6 }, (_, i) => playMatchGame(randomBot, safeRandomBot, i, { boardSize: 37 }));
    const strip = (games: ReturnType<typeof run>) =>
      games.map(g => ({ ...g, result: { ...g.result, msByPlayer: null } }));
    expect(strip(run())).toEqual(strip(run()));
  });

  it('swaps colours inside every opening pair and shares the opening', () => {
    const games = Array.from({ length: 4 }, (_, i) => playMatchGame(randomBot, randomBot, i, { boardSize: 37 }));
    expect(games.map(g => g.aWasBlue)).toEqual([true, false, true, false]);
    expect(summarizeMatch('random', 'random', games).games).toBe(4);
  });
});
