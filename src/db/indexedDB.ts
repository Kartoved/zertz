import { openDB, IDBPDatabase } from 'idb';
import { GameState, GameNode } from '../game/types';
import { serializeState, deserializeState, serializeTree, deserializeTree } from './apiClient';

const DB_NAME = 'zertz-games-summary';
const DB_VERSION = 1;
const STORE_NAME = 'games';

interface SavedGame {
  id: string;
  playerNames: { player1: string; player2: string };
  createdAt: number;
  updatedAt: number;
  moveCount: number;
  winner: string | null;
  winType: string | null;
  boardSize: 37 | 48 | 61;
  isOnline?: boolean;
  stateJson: string;
  treeJson: string;
}

function inferIsOnline(id: string, isOnline?: boolean): boolean {
  if (typeof isOnline === 'boolean') return isOnline;
  return /^\d+$/.test(id) && id.length <= 10;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
        }
      },
    });
  }
  return dbPromise;
}


export async function saveGame(
  id: string,
  state: GameState,
  tree: GameNode,
  playerNames: { player1: string; player2: string },
  winType: string | null,
  isOnline: boolean
): Promise<void> {
  const db = await getDB();
  
  const game: SavedGame = {
    id,
    playerNames,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    moveCount: state.moveNumber,
    winner: state.winner,
    winType,
    boardSize: state.boardSize,
    isOnline,
    stateJson: serializeState(state),
    treeJson: serializeTree(tree),
  };
  
  await db.put(STORE_NAME, game);
}

export async function loadGame(id: string): Promise<{
  state: GameState;
  tree: GameNode;
  playerNames: { player1: string; player2: string };
  winType: string | null;
} | null> {
  const db = await getDB();
  const game = await db.get(STORE_NAME, id) as SavedGame | undefined;
  
  if (!game) return null;
  
  return {
    state: deserializeState(game.stateJson),
    tree: deserializeTree(game.treeJson),
    playerNames: game.playerNames,
    winType: game.winType,
  };
}

export async function listGames(): Promise<Array<{
  id: string;
  playerNames: { player1: string; player2: string };
  updatedAt: number;
  moveCount: number;
  winner: string | null;
  winType: string | null;
  boardSize: 37 | 48 | 61;
  isOnline: boolean;
}>> {
  const db = await getDB();
  const games = await db.getAllFromIndex(STORE_NAME, 'updatedAt') as SavedGame[];
  
  return games.reverse().map(g => ({
    id: g.id,
    playerNames: g.playerNames,
    updatedAt: g.updatedAt,
    moveCount: g.moveCount,
    winner: g.winner,
    winType: g.winType,
    boardSize: g.boardSize,
    isOnline: inferIsOnline(g.id, g.isOnline),
  }));
}

export async function deleteGame(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}
