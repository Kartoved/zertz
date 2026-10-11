import { create } from 'zustand';
import {
  GameState,
  MarbleColor,
  CaptureMove,
  GameNode,
  Move,
  Player,
} from '../game/types';
import {
  createInitialState,
  cloneState,
  hasAvailableCaptures,
  getCaptureChains,
} from '../game/GameEngine';

import { applyPlacement, applyRingRemoval, applyCapture } from '../utils/moveActions';
import { saveGame, loadGame, listGames } from '../db/gamesStorage';
import { playPlaceSound, playRemoveRingSound, playCaptureSound, playWinSound, playUndoSound } from '../utils/sounds';
import { useAuthStore } from './authStore';
import {
  getDefaultPlayerNames,
  createRootNode,
  addMoveToTree,
  rebuildStateFromNode,
  rebuildStateFromNodeWithStart,
  findNodeAndParent,
  isDescendant,
  formatGameId,
  syncMainLineFlags,
  nodeDepth,
} from '../utils/gameTreeUtils';
import type { BotMove } from '../ai/apply';
import { BotGameConfig, BotSides, VS_HUMAN_DELAY_MS, botLabel } from '../ai/levels';
import { treeToZen } from '../game/zen';
import { saveBotGame } from '../db/botGamesApi';
import { getI18nFromStorage } from '../i18n';
import { APP_VERSION } from '../version';

const NO_BOTS: BotSides = { player1: null, player2: null };
const bothBots = (bots: BotSides) => !!bots.player1 && !!bots.player2;

interface GameStore {
  state: GameState;
  gameTree: GameNode;
  currentNode: GameNode;
  selectedMarbleColor: MarbleColor | null;
  selectedRingId: string | null;
  highlightedCaptures: CaptureMove[];
  availableCaptureChains: CaptureMove[][];
  playerNames: { player1: string; player2: string };
  gameId: string;
  // Non-standard starting position (imported ZIP/ZEN). When set, board state is
  // reconstructed by replaying from here instead of createInitialState. null for
  // ordinary games that begin from the standard board.
  customStart: GameState | null;
  savedGames: Array<{ id: string; playerNames: { player1: string; player2: string }; updatedAt: number; moveCount: number; winner: string | null; winType: string | null; boardSize: 37 | 48 | 61; isOnline: boolean }>;
  winType: string | null;
  isLoadedGame: boolean;

  // Bots: the spec playing each side (null = a person), see ai/levels.ts.
  bots: BotSides;
  /** Least time between a bot's move and the previous one (bot-vs-bot pacing). */
  botDelayMs: number;
  botPaused: boolean;
  /** The bot to move had no legal move (empty pool, nothing captured) — the game stopped. */
  botStuck: boolean;
  /** This game's result already went to /api/bot-games. */
  botGameReported: boolean;
  isBotThinking: boolean;

  newGame: (boardSize?: 37 | 48 | 61) => void;
  loadPosition: (state: GameState) => void;
  loadTree: (startState: GameState, root: GameNode, names?: { player1: string; player2: string }) => void;
  newBotGame: (config: BotGameConfig) => void;
  triggerBotMove: () => void;
  toggleBotPause: () => void;
  /** After every completed move: save, report a finished bot game, or let the next bot move. */
  afterMove: () => void;
  reportBotGame: () => void;
  selectMarbleColor: (color: MarbleColor | null) => void;
  selectRing: (ringId: string) => void;
  handlePlacement: (ringId: string) => void;
  handleRingRemoval: (ringId: string) => void;
  handleCapture: (capture: CaptureMove[]) => void;
  undo: () => void;
  surrender: () => void;
  cancelGame: () => void;
  setPlayerNames: (player1: string, player2: string) => void;
  deleteBranchFrom: (nodeId: string) => void;
  loadSavedGame: (id: string) => Promise<void>;
  refreshSavedGames: () => Promise<void>;
  getMarbleColorAt: (ringId: string) => MarbleColor | null;
  navigateToNode: (node: GameNode) => void;
  autoSave: () => Promise<void>;
}


export const useGameStore = create<GameStore>((set, get) => ({
  ...(() => {
    const defaults = getDefaultPlayerNames();
    return { playerNames: defaults };
  })(),
  state: createInitialState(),
  gameTree: createRootNode(),
  currentNode: createRootNode(),
  selectedMarbleColor: null,
  selectedRingId: null,
  highlightedCaptures: [],
  availableCaptureChains: [],
  customStart: null,
  gameId: formatGameId(Date.now()),
  savedGames: [],
  winType: null,
  isLoadedGame: false,
  bots: NO_BOTS,
  botDelayMs: VS_HUMAN_DELAY_MS,
  botPaused: false,
  botStuck: false,
  botGameReported: false,
  isBotThinking: false,
  
  newGame: (boardSize = 37) => {
    const rootNode = createRootNode();
    const newGameId = formatGameId(Date.now());
    const authUser = useAuthStore.getState().user;
    const defaults = getDefaultPlayerNames();
    const player1Name = authUser ? authUser.username : defaults.player1;
    set({
      state: createInitialState(boardSize),
      gameTree: rootNode,
      currentNode: rootNode,
      selectedMarbleColor: null,
      selectedRingId: null,
      highlightedCaptures: [],
      availableCaptureChains: [],
      customStart: null,
      playerNames: { player1: player1Name, player2: defaults.player2 },
      gameId: newGameId,
      winType: null,
      isLoadedGame: false,
      bots: NO_BOTS,
      botPaused: false,
      botStuck: false,
      isBotThinking: false,
    });
  },

  // Start a fresh local game from an arbitrary position (e.g. imported ZIP). The
  // position is a custom start, so record it for navigation back to the root.
  loadPosition: (state) => {
    const rootNode = createRootNode();
    const defaults = getDefaultPlayerNames();
    const authUser = useAuthStore.getState().user;
    set({
      state,
      gameTree: rootNode,
      currentNode: rootNode,
      selectedMarbleColor: null,
      selectedRingId: null,
      highlightedCaptures: [],
      availableCaptureChains: [],
      customStart: cloneState(state),
      playerNames: { player1: authUser ? authUser.username : defaults.player1, player2: defaults.player2 },
      gameId: formatGameId(Date.now()),
      winType: null,
      isLoadedGame: false,
      bots: NO_BOTS,
      botPaused: false,
      botStuck: false,
      isBotThinking: false,
    });
  },

  // Load a whole imported game (ZEN) as a local game to navigate/analyze. The
  // start position (which may be a custom setup) is recorded so navigation
  // replays from it rather than the standard board.
  loadTree: (startState, root, names) => {
    const defaults = getDefaultPlayerNames();
    set({
      state: startState,
      gameTree: root,
      currentNode: root,
      selectedMarbleColor: null,
      selectedRingId: null,
      highlightedCaptures: [],
      availableCaptureChains: [],
      customStart: cloneState(startState),
      playerNames: names ?? defaults,
      gameId: formatGameId(Date.now()),
      winType: null,
      isLoadedGame: true,
      bots: NO_BOTS,
      botPaused: false,
      botStuck: false,
      isBotThinking: false,
    });
  },

  newBotGame: ({ boardSize, bots, delayMs }) => {
    const rootNode = createRootNode();
    const newGameId = formatGameId(Date.now());
    const authUser = useAuthStore.getState().user;
    const defaults = getDefaultPlayerNames();
    const { t } = getI18nFromStorage();
    const name = (side: Player, fallback: string) => {
      const spec = bots[side];
      return spec ? `🤖 ${botLabel(t, spec)}` : fallback;
    };
    const names = {
      player1: name('player1', authUser ? authUser.username : defaults.player1),
      player2: name('player2', defaults.player2),
    };
    set({
      state: createInitialState(boardSize),
      gameTree: rootNode,
      currentNode: rootNode,
      selectedMarbleColor: null,
      selectedRingId: null,
      highlightedCaptures: [],
      availableCaptureChains: [],
      customStart: null,
      playerNames: names,
      gameId: newGameId,
      winType: null,
      isLoadedGame: false,
      bots,
      botDelayMs: delayMs,
      botPaused: false,
      botStuck: false,
      botGameReported: false,
      isBotThinking: false,
    });
    // If a bot moves first, start it.
    setTimeout(() => get().triggerBotMove(), 100);
  },

  selectMarbleColor: (color) => {
    set({ selectedMarbleColor: color, selectedRingId: null });
  },
  
  selectRing: (ringId) => {
    const { state, selectedMarbleColor } = get();
    
    // Ring removal phase has priority - player must remove ring before turn ends
    if (state.phase === 'ringRemoval') {
      get().handleRingRemoval(ringId);
      return;
    }
    
    // Only check captures during placement phase when no marble is being placed
    if (state.phase === 'placement' && hasAvailableCaptures(state)) {
      const ring = state.rings.get(ringId);
      if (ring?.marble) {
        const chains = getCaptureChains(state, ringId);
        if (chains.length > 0) {
          // Terminal-only highlighting — see roomStore.selectRing for rationale.
          set({
            selectedRingId: ringId,
            highlightedCaptures: chains.map(c => c[c.length - 1]),
            availableCaptureChains: chains,
          });
        } else {
          // Marble with no valid captures — clear any stale selection.
          set({ selectedRingId: null, highlightedCaptures: [], availableCaptureChains: [] });
        }
      } else {
        // Clicked empty ring during mandatory-capture phase — clear selection.
        set({ selectedRingId: null, highlightedCaptures: [], availableCaptureChains: [] });
      }
      return;
    }
    
    if (state.phase === 'placement' && selectedMarbleColor) {
      get().handlePlacement(ringId);
    }
  },
  
  handlePlacement: (ringId) => {
    const { state, selectedMarbleColor, currentNode } = get();
    if (!selectedMarbleColor) return;

    const result = applyPlacement(state, ringId, selectedMarbleColor);
    if (!result) return;

    const { newState, move, winner, winType, needsRingRemoval } = result;
    playPlaceSound();
    if (winner) playWinSound();

    if (!needsRingRemoval) {
      const newNode = addMoveToTree(currentNode, move, state.currentPlayer, state.moveNumber, state.boardSize);
      set({ state: newState, currentNode: newNode, selectedMarbleColor: null, selectedRingId: null, winType });
      get().afterMove();
    } else {
      set({ state: newState, selectedMarbleColor: null });
    }
  },
  
  handleRingRemoval: (ringId) => {
    const { state, currentNode } = get();
    if (state.phase !== 'ringRemoval' || !state.pendingPlacement) return;

    const pendingPlacement = state.pendingPlacement;
    // In gameStore the full move (placement + ring) is added to tree here as one node
    const move: Move = {
      type: 'placement',
      data: { marbleColor: pendingPlacement.marbleColor, ringId: pendingPlacement.ringId, removedRingId: ringId },
    };
    // Temporarily attach the move so applyRingRemoval can update notation
    const tempNode = { ...currentNode, move };
    const result = applyRingRemoval(state, tempNode, ringId);
    if (!result) return;

    const { newState, winner, winType } = result;
    if (tempNode.move?.type === 'placement') {
      move.data.isolatedCaptures = tempNode.move.data.isolatedCaptures;
    }

    const newNode = addMoveToTree(currentNode, move, state.currentPlayer, state.moveNumber, state.boardSize);
    // Copy updated notation from tempNode
    newNode.notation = tempNode.notation || newNode.notation;

    playRemoveRingSound();
    if (winner) playWinSound();

    set({ state: newState, currentNode: newNode, selectedRingId: null, winType });
    get().afterMove();
  },

  handleCapture: (captures) => {
    const { state, currentNode } = get();
    if (captures.length === 0) return;

    const { newState, move, previousPlayer, previousMoveNumber, winner, winType } = applyCapture(state, captures);
    const newNode = addMoveToTree(currentNode, move, previousPlayer, previousMoveNumber, state.boardSize);

    playCaptureSound();
    if (winner) playWinSound();

    set({ state: newState, currentNode: newNode, selectedRingId: null, highlightedCaptures: [], availableCaptureChains: [], winType });
    get().afterMove();
  },
  
  undo: () => {
    const undoOnce = (): boolean => {
      const { state, currentNode } = get();
      if (!currentNode.parent || state.winner) return false;

      // Delete the state node from tree
      const parentNode = currentNode.parent;
      const idx = parentNode.children.indexOf(currentNode);
      if (idx > -1) {
        parentNode.children.splice(idx, 1);
      }

      // We already have rebuild logic down in navigateToNode
      get().navigateToNode(parentNode);
      return true;
    };
    if (!undoOnce()) return;
    // Against a bot, take back the bot's answer too: back to the person's turn.
    const { bots, state } = get();
    if (!bothBots(bots) && bots[state.currentPlayer]) undoOnce();
    playUndoSound();
    // Back at the start with the bot to move (it plays first): let it move again.
    if (bots[get().state.currentPlayer]) setTimeout(() => get().triggerBotMove(), 0);
  },

  surrender: () => {
    const { state } = get();
    if (state.winner) return;
    const newState = cloneState(state);
    newState.winner = state.currentPlayer === 'player1' ? 'player2' : 'player1';
    newState.phase = 'gameOver';
    set({
      state: newState,
      winType: 'surrender',
    });
    get().autoSave();
    get().reportBotGame();
  },

  cancelGame: () => {
    const { state } = get();
    if (state.winner) return;
    const newState = cloneState(state);
    newState.winner = 'cancelled' as any;
    newState.phase = 'gameOver';
    set({
      state: newState,
      winType: 'cancelled',
    });
    get().autoSave();
    get().reportBotGame();
  },
  
  setPlayerNames: (player1, player2) => {
    set({ playerNames: { player1, player2 } });
    get().autoSave();
  },

  deleteBranchFrom: (nodeId) => {
    const { gameTree, currentNode, state } = get();
    const result = findNodeAndParent(gameTree, nodeId);
    if (!result || !result.parent) return;
    const { node, parent } = result;
    const idx = parent.children.indexOf(node);
    if (idx >= 0) {
      parent.children.splice(idx, 1);
      syncMainLineFlags(parent);
    }

    const shouldRewind = isDescendant(node, currentNode.id);
    const targetNode = shouldRewind ? parent : currentNode;
    const customStart = get().customStart;
    const newState = customStart
      ? rebuildStateFromNodeWithStart(customStart, targetNode)
      : rebuildStateFromNode(targetNode, state.boardSize);

    set({
      state: newState,
      currentNode: targetNode,
      selectedMarbleColor: null,
      selectedRingId: null,
      highlightedCaptures: [],
      availableCaptureChains: [],
    });

    get().autoSave();
  },
  
  loadSavedGame: async (id: string) => {
    const saved = await loadGame(id);
    if (saved) {
      set({
        state: saved.state,
        gameTree: saved.tree,
        currentNode: saved.tree,
        customStart: null,
        playerNames: saved.playerNames,
        gameId: id,
        selectedMarbleColor: null,
        selectedRingId: null,
        highlightedCaptures: [],
        winType: saved.winType,
        isLoadedGame: true,
      });
    }
  },
  
  refreshSavedGames: async () => {
    const games = await listGames();
    set({ savedGames: games });
  },
  
  getMarbleColorAt: (ringId: string) => {
    const { state } = get();
    const ring = state.rings.get(ringId);
    return ring?.marble?.color || null;
  },
  
  navigateToNode: (targetNode: GameNode) => {
    const { customStart, state, bots } = get();
    if (bothBots(bots)) set({ botPaused: true });
    const newState = customStart
      ? rebuildStateFromNodeWithStart(customStart, targetNode)
      : rebuildStateFromNode(targetNode, state.boardSize);

    set({
      state: newState,
      currentNode: targetNode,
      selectedMarbleColor: null,
      selectedRingId: null,
      highlightedCaptures: [],
      availableCaptureChains: [],
    });
  },
  
  triggerBotMove: () => {
    const { state, bots, isBotThinking, botPaused, botDelayMs, currentNode, gameId } = get();
    const spec = bots[state.currentPlayer];
    if (!spec || state.winner || isBotThinking || botPaused) return;
    if (state.phase === 'ringRemoval') return;

    set({ isBotThinking: true });
    const started = Date.now();
    const worker = new Worker(new URL('../ai/worker.ts', import.meta.url), { type: 'module' });
    const done = () => { worker.terminate(); set({ isBotThinking: false }); };

    worker.onmessage = (e: MessageEvent<{ move: BotMove | null }>) => {
      // A bot-vs-bot game is paced so a person can follow it.
      const wait = Math.max(0, botDelayMs - (Date.now() - started));
      setTimeout(() => {
        done();
        const now = get();
        // The position moved on while the bot thought (new game, undo, browsing,
        // pause): the answer belongs to a position that is no longer on the board.
        if (now.gameId !== gameId || now.currentNode !== currentNode || now.state.winner || now.botPaused) return;

        const { move } = e.data;
        if (!move) {
          set({ botStuck: true });
          return;
        }
        if (move.type === 'capture') {
          get().handleCapture(move.chain);
        } else {
          // Set marble color so handlePlacement can read it, then place
          set({ selectedMarbleColor: move.color });
          get().handlePlacement(move.ringId);
          // If ring removal is needed, handle it synchronously after state settles
          if (move.removedRingId && get().state.phase === 'ringRemoval') {
            get().handleRingRemoval(move.removedRingId);
          }
        }
      }, wait);
    };
    worker.onerror = (err) => {
      console.error('[Bot] worker error:', err);
      done();
    };

    worker.postMessage({ state, spec });
  },

  toggleBotPause: () => {
    const paused = !get().botPaused;
    set({ botPaused: paused });
    if (!paused) setTimeout(() => get().triggerBotMove(), 0);
  },

  afterMove: () => {
    const { state, bots } = get();
    // A bot-vs-bot game is reported once at the end; saving it every move would
    // only flood the games list.
    if (!bothBots(bots)) get().autoSave();
    if (state.winner) get().reportBotGame();
    else setTimeout(() => get().triggerBotMove(), 0);
  },

  reportBotGame: () => {
    const { bots, botGameReported, state, gameTree, customStart, playerNames, winType, currentNode } = get();
    if (botGameReported || !state.winner || (!bots.player1 && !bots.player2)) return;
    set({ botGameReported: true });
    const winner = state.winner === 'player1' || state.winner === 'player2' ? state.winner : null;
    const zen = treeToZen(customStart ?? createInitialState(state.boardSize), gameTree, {
      Player1: playerNames.player1,
      Player2: playerNames.player2,
      Result: winner === 'player1' ? '1-0' : winner === 'player2' ? '0-1' : '*',
      ...(winType ? { WinType: winType } : {}),
    });
    saveBotGame({
      player1: bots.player1 ?? 'human',
      player2: bots.player2 ?? 'human',
      boardSize: state.boardSize,
      winner,
      winType,
      plies: nodeDepth(currentNode),
      zen,
      appVersion: APP_VERSION,
    }).catch(err => console.warn('[Bot] game not reported:', err));
  },

  autoSave: async () => {
    const { state, gameTree, playerNames, gameId, winType } = get();
    await saveGame(gameId, state, gameTree, playerNames, winType, false);
  },
}));
