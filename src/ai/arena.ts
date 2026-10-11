/**
 * Bot-vs-bot match runner: the measuring stick for every AI change.
 *
 * Ported from Quantum Battle (docs/BOT_LESSONS_FROM_QUANTUM.md), where every
 * conclusion about the bot came from it — and where the measurements were wrong
 * several times before they were right. The lessons are built in:
 *
 *  - Games start from an opening BOOK (positions/book*.ts) and every opening is
 *    played twice with colours swapped. Two deterministic bots without varied
 *    openings play one game N times.
 *  - The honest error bar is over opening PAIRS (`pairSummary`): the two games
 *    of a pair share an opening and are not independent.
 *  - Seeds come from the game index alone, so a match split across processes
 *    (scripts/match.ts) is the same match.
 *
 * Pure TypeScript, no DOM. Moves go through `applyBotMove`, the same path the
 * UI uses, so a bot that wins here is not winning against a private ruleset.
 */

import { GameState, Player } from '../game/types';
import { createInitialState, getWinType } from '../game/GameEngine';
import { BotMove, applyBotMove, generateAllMoves, moveFromKey } from './apply';
import { recordGame } from './record';
import type { Bot } from './bots';
import { BOOKS, BookOpening } from './positions/books';

/** Deterministic LCG — a failed match is reproducible from its seed alone. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export type BoardSize = 37 | 48 | 61;

/**
 * How a game ended. `noMarbles`: the side to move has no capture, the pool is
 * empty and it has captured nothing to place — the rules say nothing about it
 * (IDEAS.md), so it is reported apart and scored as a draw until they do.
 */
export type WinType = 'white' | 'gray' | 'black' | 'mixed' | 'fullBoard' | 'noMarbles' | 'unknown';

export interface GameResult {
  /** Who won; null for `noMarbles` and for a game that hit the ply cap. */
  winner: Player | null;
  winType: WinType | null;
  plies: number;
  /** Total thinking time per side, milliseconds. */
  msByPlayer: Record<Player, number>;
  cappedOut: boolean;
  /** The whole game as ZEN, opening included — only when `record` was set. */
  zen?: string;
}

export interface PlayOptions {
  boardSize?: BoardSize;
  /** Picks the book opening (and drives raw random opening plies). */
  seed?: number;
  /**
   * Each bot's own random stream. playMatchGame keys them by BOT, not by seat:
   * with one shared stream, a bot playing itself plays the same game from both
   * colours, and "A vs A is level" says nothing about noise.
   */
  blueSeed?: number;
  redSeed?: number;
  /** Safety net: a bot that stops producing progress must not hang the match. */
  maxPlies?: number;
  /** Start from the board's opening book (default) — otherwise from `openingPlies` random plies. */
  book?: boolean;
  /** With `book`: these openings instead of the checked-in book. */
  openings?: BookOpening[];
  /** Raw random plies before the bots take over, when `book` is off. */
  openingPlies?: number;
  /** Keep every move and return the game as ZEN. */
  record?: boolean;
}

/** The position a book opening leads to, replayed move by move from the start. */
export function openingState(boardSize: BoardSize, opening: BookOpening): GameState {
  let state = createInitialState(boardSize);
  for (const key of opening.moves) state = applyBotMove(state, moveFromKey(state, key));
  return state;
}

/** One game. `blue` (player1) moves first — the caller decides who gets that seat. */
export function playGame(blue: Bot, red: Bot, opts: PlayOptions = {}): GameResult {
  const { boardSize = 48, seed = 1, maxPlies = 300, book = true, openingPlies = 0, record = false } = opts;
  const rand = rng(seed);
  const randBlue = rng(opts.blueSeed ?? seed * 2);
  const randRed = rng(opts.redSeed ?? seed * 2 + 1);
  const msByPlayer: Record<Player, number> = { player1: 0, player2: 0 };

  let state = createInitialState(boardSize);
  let plies = 0;
  if (book) {
    const openings = opts.openings ?? BOOKS[boardSize];
    if (!openings?.length) throw new Error(`no opening book for the ${boardSize}-ring board — build one with scripts/book.ts`);
    const opening = openings[(seed - 1) % openings.length];
    state = openingState(boardSize, opening);
    plies = opening.moves.length;
  }

  const start = state;
  const played: BotMove[] = [];
  const play = (move: BotMove) => {
    if (record) played.push(move);
    state = applyBotMove(state, move);
    plies++;
  };
  const finish = (result: Omit<GameResult, 'plies' | 'msByPlayer'>): GameResult => {
    const full: GameResult = { ...result, plies, msByPlayer };
    if (!record) return full;
    const Result = result.winner === 'player1' ? '1-0' : result.winner === 'player2' ? '0-1' : '*';
    const meta = { Player1: blue.name, Player2: red.name, Result, ...(result.winType ? { WinType: result.winType } : {}) };
    return { ...full, zen: recordGame(start, played, meta).zen };
  };

  // Shared, bot-independent random opening (only without a book).
  for (let i = 0; i < openingPlies && !book && !state.winner; i++) {
    const options = generateAllMoves(state);
    if (options.length === 0) break;
    play(options[Math.floor(rand() * options.length)]);
  }

  while (plies < maxPlies) {
    if (state.winner) {
      const winner = state.winner as Player;
      return finish({ winner, winType: getWinType(state, winner) as WinType, cappedOut: false });
    }
    if (generateAllMoves(state).length === 0) {
      return finish({ winner: null, winType: 'noMarbles', cappedOut: false });
    }

    const mover = state.currentPlayer;
    const bot = mover === 'player1' ? blue : red;
    const t0 = Date.now();
    const move = bot.pickMove(state, mover, mover === 'player1' ? randBlue : randRed);
    msByPlayer[mover] += Date.now() - t0;
    if (!move) throw new Error(`${bot.name} returned no move in a position that has legal moves`);
    play(move);
  }

  return finish({ winner: null, winType: null, cappedOut: true });
}

/** One game of a match, as played — possibly in another process. */
export interface MatchGame {
  index: number;
  aWasBlue: boolean;
  result: GameResult;
}

/**
 * Game `index` of a match. Even and odd indices share an opening and swap
 * colours, so a first-move advantage cancels out; the seed is derived from the
 * index alone, which is what lets a match be split across processes and still
 * be the same match.
 */
export function playMatchGame(a: Bot, b: Bot, index: number, opts: PlayOptions = {}): MatchGame {
  const { seed = 1, ...rest } = opts;
  const aWasBlue = index % 2 === 0;
  const pairSeed = seed + (index >> 1);
  const [seedA, seedB] = [pairSeed * 2, pairSeed * 2 + 1];
  return {
    index,
    aWasBlue,
    result: playGame(aWasBlue ? a : b, aWasBlue ? b : a, {
      ...rest,
      seed: pairSeed,
      blueSeed: aWasBlue ? seedA : seedB,
      redSeed: aWasBlue ? seedB : seedA,
    }),
  };
}

export interface MatchResult {
  a: string;
  b: string;
  games: number;
  /** From A's point of view. */
  wins: number;
  losses: number;
  draws: number;
  score: number;
  elo: number;
  /** ±95% on `elo`, treating games as independent — optimistic; see pairSummary. */
  eloMargin: number;
  avgPlies: number;
  avgMoveMs: Record<string, number>;
  winTypes: Record<string, number>;
  capped: number;
}

const clampScore = (score: number, n: number) => Math.min(Math.max(score, 0.5 / n), 1 - 0.5 / n);

/** Elo implied by a score rate; a clean sweep is clamped half a game short of perfect. */
export function scoreToElo(score: number, n: number): number {
  return -400 * Math.log10(1 / clampScore(score, n) - 1);
}

function eloMargin(score: number, games: number): number {
  const s = clampScore(score, games);
  const se = Math.sqrt((s * (1 - s)) / games);
  return 1.96 * se * (400 / (Math.log(10) * s * (1 - s)));
}

/** A's score in one game: 1 win, 0 loss, ½ for anything without a winner. */
export function scoreForA(game: MatchGame): number {
  const aSeat: Player = game.aWasBlue ? 'player1' : 'player2';
  return game.result.winner === null ? 0.5 : game.result.winner === aSeat ? 1 : 0;
}

export function summarizeMatch(aName: string, bName: string, played: MatchGame[]): MatchResult {
  const games = played.length;
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let totalPlies = 0;
  let capped = 0;
  const ms = { a: 0, b: 0 };
  const moves = { a: 0, b: 0 };
  const winTypes: Record<string, number> = {};

  for (const game of played) {
    const { aWasBlue, result } = game;
    const s = scoreForA(game);
    if (s === 1) wins++;
    else if (s === 0) losses++;
    else draws++;
    if (result.cappedOut) capped++;
    totalPlies += result.plies;
    const type = result.winType ?? 'capped';
    winTypes[type] = (winTypes[type] ?? 0) + 1;
    ms.a += result.msByPlayer[aWasBlue ? 'player1' : 'player2'];
    ms.b += result.msByPlayer[aWasBlue ? 'player2' : 'player1'];
    // Plies split between the sides; close enough for a per-move average.
    moves.a += result.plies / 2;
    moves.b += result.plies / 2;
  }

  const score = games ? (wins + draws / 2) / games : 0;
  return {
    a: aName,
    b: bName,
    games,
    wins,
    losses,
    draws,
    score,
    elo: scoreToElo(score, games),
    eloMargin: eloMargin(score, games),
    avgPlies: games ? totalPlies / games : 0,
    avgMoveMs: { [aName]: moves.a ? ms.a / moves.a : 0, [bName]: moves.b ? ms.b / moves.b : 0 },
    winTypes,
    capped,
  };
}

/**
 * The margin over opening PAIRS instead of games: a lopsided opening wins
 * both colours for whoever drew the good side, so the pair is the sample.
 */
export function pairSummary(played: MatchGame[]): { elo: number; lo: number; hi: number; pairs: number; split: number[] } | null {
  const byPair = new Map<number, number[]>();
  for (const game of played) {
    const key = game.index >> 1;
    byPair.set(key, [...(byPair.get(key) ?? []), scoreForA(game)]);
  }
  const scores = [...byPair.values()].filter(p => p.length === 2).map(p => (p[0] + p[1]) / 2);
  const n = scores.length;
  if (n < 2) return null;
  const mean = scores.reduce((x, y) => x + y, 0) / n;
  const variance = scores.reduce((x, y) => x + (y - mean) ** 2, 0) / (n - 1);
  const se = Math.sqrt(variance / n);
  return {
    elo: scoreToElo(mean, n),
    lo: scoreToElo(mean - 1.96 * se, n),
    hi: scoreToElo(mean + 1.96 * se, n),
    pairs: n,
    split: [0, 0.25, 0.5, 0.75, 1].map(v => scores.filter(x => x === v).length),
  };
}

const signed = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(0)}`;

/** One-line-per-fact summary for a terminal. */
export function formatMatch(r: MatchResult, played: MatchGame[]): string {
  const pairs = pairSummary(played);
  const blueWins = played.filter(g => g.result.winner === 'player1').length;
  return [
    `${r.a}  vs  ${r.b}`,
    `  ${r.wins}W ${r.losses}L ${r.draws}D of ${r.games}   score ${(r.score * 100).toFixed(1)}%`,
    `  Elo ${signed(r.elo)} ±${r.eloMargin.toFixed(0)} by games (for ${r.a})`,
    pairs
      ? `  by pairs: Elo ${signed(pairs.elo)} [${signed(pairs.lo)}, ${signed(pairs.hi)}]  (${pairs.pairs} pairs, 0/¼/½/¾/1 = ${pairs.split.join('/')})` +
        // Every pair to one side: the number is a clamp, not a measurement.
        (pairs.split[0] === pairs.pairs || pairs.split[4] === pairs.pairs ? '  SATURATED — only "far stronger" is known' : '')
      : '  by pairs: too few pairs',
    `  avg game ${r.avgPlies.toFixed(1)} plies` + (r.capped ? `, ${r.capped} hit the ply cap` : ''),
    `  avg move ${r.a}: ${r.avgMoveMs[r.a].toFixed(0)} ms | ${r.b}: ${r.avgMoveMs[r.b].toFixed(0)} ms`,
    `  endings: ${Object.entries(r.winTypes).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}`,
    `  blue (moves first) won ${blueWins} of ${played.length}`,
  ].join('\n');
}
