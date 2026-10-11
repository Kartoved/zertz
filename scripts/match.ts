/**
 * A match between two bots, split across processes. Ported from Quantum Battle.
 *
 *   npx vite-node scripts/match.ts -- --a=greedy --b=minimax-easy --games=200
 *
 * Options: --board=48 (37/48/61), --seed=1, --jobs=4, --book=0 with --opening=N
 * for raw random plies instead of the book, --record to keep every game as
 * ZEN — in --out=file.jsonl, by default ../zertz-matches/<a>-vs-<b>-<board>-<time>.jsonl
 * (next to the repo, not in it: the games are kept, not committed).
 *
 * Bots are spec strings (src/ai/botSpec.ts). Every game's seed comes from its
 * index, so the same options give the same match however many --jobs play it;
 * opening pairs (same opening, colours swapped) stay in one process.
 *
 * Both bots of a game share one core, so contention is symmetric — but never run
 * more jobs than PHYSICAL cores (4 on the author's machine), or time budgets
 * stop meaning what they say.
 */

import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MatchGame, formatMatch, playMatchGame, scoreForA, summarizeMatch } from '../src/ai/arena';
import { botFromSpec } from '../src/ai/botSpec';

const args = new Map<string, string>();
for (const raw of process.argv.slice(2)) {
  // `--flag` alone means `--flag=1`.
  const m = /^--([^=]+)(?:=(.*))?$/.exec(raw);
  if (m) args.set(m[1], m[2] ?? '1');
}

const a = args.get('a') ?? 'greedy';
const b = args.get('b') ?? 'minimax-easy';
const games = Number(args.get('games') ?? 100);
const boardSize = Number(args.get('board') ?? 48) as 37 | 48 | 61;
const seed = Number(args.get('seed') ?? 1);
const book = args.get('book') !== '0';
const openingPlies = Number(args.get('opening') ?? 4);
const record = args.has('record');
const jobs = Math.max(1, Number(args.get('jobs') ?? Math.min(4, cpus().length)));
const worker = args.get('worker');

if (worker !== undefined) {
  const k = Number(worker);
  const botA = botFromSpec(a);
  const botB = botFromSpec(b);
  for (let i = 0; i < games; i++) {
    if ((i >> 1) % jobs !== k) continue;
    const game = playMatchGame(botA, botB, i, { boardSize, seed, book, openingPlies, record });
    process.stdout.write(`GAME ${JSON.stringify(game)}\n`);
  }
} else {
  await runParent();
}

async function runParent(): Promise<void> {
  const started = Date.now();
  console.log(`${a}  vs  ${b}`);
  console.log(`${games} games on ${boardSize}, ${book ? 'book openings' : `${openingPlies} random opening plies`}, seed ${seed}, ${jobs} jobs`);

  const played: MatchGame[] = [];
  let score = 0;
  const viteNode = resolve('node_modules/vite-node/vite-node.mjs');
  const children = Array.from({ length: jobs }, (_, k) =>
    new Promise<void>((done, fail) => {
      const child = spawn(
        process.execPath,
        [viteNode, 'scripts/match.ts', '--', ...process.argv.slice(2).filter(x => x !== '--'), `--worker=${k}`, `--jobs=${jobs}`],
        { stdio: ['ignore', 'pipe', 'inherit'] },
      );
      let buffer = '';
      child.stdout.on('data', chunk => {
        buffer += chunk;
        let nl: number;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith('GAME ')) continue;
          const game: MatchGame = JSON.parse(line.slice(5));
          played.push(game);
          score += scoreForA(game);
          process.stdout.write(`\r  ${played.length}/${games}  score ${score}  ${((Date.now() - started) / 1000).toFixed(0)}s   `);
        }
      });
      child.on('exit', code => (code === 0 ? done() : fail(new Error(`worker ${k} exited with ${code}`))));
    }),
  );
  await Promise.all(children);
  process.stdout.write('\n\n');

  played.sort((x, y) => x.index - y.index);
  console.log(formatMatch(summarizeMatch(a, b, played), played));
  console.log(`  wall ${((Date.now() - started) / 1000).toFixed(0)}s`);

  // Every recorded game is kept, for questions nobody thought to ask yet.
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  const safe = (spec: string) => spec.replace(/[^a-z0-9=.,-]+/gi, '_');
  const out = args.get('out') ?? (record ? resolve('..', 'zertz-matches', `${safe(a)}-vs-${safe(b)}-${boardSize}-${stamp}.jsonl`) : undefined);
  if (out) {
    mkdirSync(resolve(out, '..'), { recursive: true });
    writeFileSync(out, played.map(g => JSON.stringify(g) + '\n').join(''));
    console.log(`  games: ${out}`);
  }
}
