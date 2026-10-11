/**
 * What recorded matches say about the GAME rather than the bots.
 *
 *   npx vite-node scripts/gamestats.ts -- a.jsonl b.jsonl …
 *
 * Reads matches played with `match.ts --record --out=…` and reports, over the
 * distinct games of each file: length after the book, how games end, which
 * colour wins, how much of the board is left, and how often the eventual
 * winner was BEHIND at some point — whether a game can be turned around or is
 * decided by the first mistake.
 *
 * "Progress" is how far a player is toward their nearest goal (4 white, 5 grey,
 * 6 black, or 3 of each), as a fraction; "behind" means the opponent was at
 * least a quarter of a goal ahead (one white marble's worth).
 */

import { readFileSync } from 'node:fs';
import { zenToTree } from '../src/game/zen';
import { executeCapture, placeMarble, removeRing, skipRingRemoval, cloneState } from '../src/game/GameEngine';
import { Captures, GameNode, GameState, Move, Player } from '../src/game/types';
import type { MatchGame } from '../src/ai/arena';

function progress(c: Captures): number {
  return Math.max(c.white / 4, c.gray / 5, c.black / 6, Math.min(c.white, c.gray, c.black) / 3);
}

function apply(state: GameState, move: Move): GameState {
  const s = cloneState(state);
  if (move.type === 'capture') executeCapture(s, [move.data, ...(move.data.chain ?? [])]);
  else {
    placeMarble(s, move.data.ringId, move.data.marbleColor);
    if (move.data.removedRingId) removeRing(s, move.data.removedRingId);
    else skipRingRemoval(s);
  }
  return s;
}

const pct = (n: number, d: number) => `${d ? ((100 * n) / d).toFixed(0) : 0}%`;

for (const file of process.argv.slice(2).filter(a => !a.startsWith('--'))) {
  const games: MatchGame[] = readFileSync(file, 'utf-8').trim().split('\n').map(line => JSON.parse(line));
  const seen = new Set<string>();
  const distinct = games.filter(g => g.result.zen && !seen.has(g.result.zen) && seen.add(g.result.zen));

  let plies = 0;
  let ringsLeft = 0;
  let ringsTotal = 0;
  let captured = 0;
  let blueWins = 0;
  let decided = 0;
  let winnerWasBehind = 0;
  let isolationGames = 0;
  const endings: Record<string, number> = {};

  for (const game of distinct) {
    const { result } = game;
    endings[result.winType ?? 'capped'] = (endings[result.winType ?? 'capped'] ?? 0) + 1;
    const { startState, root } = zenToTree(result.zen!);
    let state = startState;
    let node: GameNode = root;
    let maxDeficit: Record<Player, number> = { player1: 0, player2: 0 };
    let n = 0;
    let isolation = false;
    while (node.children.length > 0) {
      node = node.children[0];
      if (!node.move) continue;
      if (node.move.type === 'placement' && node.move.data.isolatedCaptures?.length) isolation = true;
      state = apply(state, node.move);
      n++;
      const p1 = progress(state.captures.player1);
      const p2 = progress(state.captures.player2);
      maxDeficit = { player1: Math.max(maxDeficit.player1, p2 - p1), player2: Math.max(maxDeficit.player2, p1 - p2) };
    }
    plies += n;
    ringsLeft += [...state.rings.values()].filter(r => !r.isRemoved).length;
    ringsTotal += state.rings.size;
    captured += (['player1', 'player2'] as const)
      .reduce((sum, p) => sum + state.captures[p].white + state.captures[p].gray + state.captures[p].black, 0);
    if (isolation) isolationGames++;
    if (result.winner) {
      decided++;
      if (result.winner === 'player1') blueWins++;
      if (maxDeficit[result.winner] >= 0.25 - 1e-9) winnerWasBehind++;
    }
  }

  const d = distinct.length;
  console.log(`${file}`);
  console.log(`  distinct games ${d} of ${games.length}`);
  console.log(`  plies after the book ${(plies / d).toFixed(1)}, marbles captured ${(captured / d).toFixed(1)}, rings left ${pct(ringsLeft, ringsTotal)}`);
  console.log(`  endings: ${Object.entries(endings).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${pct(v, d)}`).join(', ')}`);
  console.log(`  blue (moves first) won ${pct(blueWins, decided)} of decided games`);
  console.log(`  the winner was behind by a quarter goal or more at some point: ${pct(winnerWasBehind, decided)}`);
  console.log(`  games with an isolation capture: ${pct(isolationGames, d)}\n`);
}
