import { openDB, IDBPDatabase } from 'idb';
import { GameState, GameNode } from '../game/types';

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
  stateJson: string;
  treeJson: string;
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

function serializeState(state: GameState): string {
  const obj = {
    ...state,
    rings: Array.from(state.rings.entries()),
  };
  return JSON.stringify(obj);
}

function deserializeState(json: string): GameState {
  const obj = JSON.parse(json);
  return {
    ...obj,
    rings: new Map(obj.rings),
  };
}

function serializeTree(node: GameNode): string {
  function serializeNode(n: GameNode): object {
    return {
      ...n,
      parent: null,
      children: n.children.map(c => serializeNode(c)),
    };
  }
  return JSON.stringify(serializeNode(node));
}

function deserializeTree(json: string): GameNode {
  const obj = JSON.parse(json);
  
  function rebuildNode(n: object, parent: GameNode | null): GameNode {
    const node = n as GameNode;
    node.parent = parent;
    node.children = (node.children || []).map((c: object) => rebuildNode(c, node));
    return node;
  }
  
  return rebuildNode(obj, null);
}

export async function saveGame(
  id: string,
  state: GameState,
  tree: GameNode,
  playerNames: { player1: string; player2: string },
  winType: string | null
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
  }));
}

export async function deleteGame(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}
