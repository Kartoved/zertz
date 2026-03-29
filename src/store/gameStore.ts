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
  findNodeAndParent,
  isDescendant,
  formatGameId,
} from '../utils/gameTreeUtils';
import { BotLevel, BotMove } from '../ai/minimax';

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
  savedGames: Array<{ id: string; playerNames: { player1: string; player2: string }; updatedAt: number; moveCount: number; winner: string | null; winType: string | null; boardSize: 37 | 48 | 61; isOnline: boolean }>;
  winType: string | null;
  isLoadedGame: boolean;

  // Bot
  botPlayer: Player | null;
  botLevel: BotLevel;
  isBotThinking: boolean;

  newGame: (boardSize?: 37 | 48 | 61) => void;
  newBotGame: (boardSize: 37 | 48 | 61, botPlayer: Player, level: BotLevel) => void;
  triggerBotMove: () => void;
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
  gameId: formatGameId(Date.now()),
  savedGames: [],
  winType: null,
  isLoadedGame: false,
  botPlayer: null,
  botLevel: 'medium',
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
      playerNames: { player1: player1Name, player2: defaults.player2 },
      gameId: newGameId,
      winType: null,
      isLoadedGame: false,
      botPlayer: null,
      isBotThinking: false,
    });
  },

  newBotGame: (boardSize, botPlayer, level) => {
    const rootNode = createRootNode();
    const newGameId = formatGameId(Date.now());
    const authUser = useAuthStore.getState().user;
    const defaults = getDefaultPlayerNames();
    const player1Name = authUser ? authUser.username : defaults.player1;
    const names = {
      player1: botPlayer === 'player1' ? 'Bot' : player1Name,
      player2: botPlayer === 'player2' ? 'Bot' : defaults.player2,
    };
    const initialState = createInitialState(boardSize);
    set({
      state: initialState,
      gameTree: rootNode,
      currentNode: rootNode,
      selectedMarbleColor: null,
      selectedRingId: null,
      highlightedCaptures: [],
      availableCaptureChains: [],
      playerNames: names,
      gameId: newGameId,
      winType: null,
      isLoadedGame: false,
      botPlayer,
      botLevel: level,
      isBotThinking: false,
    });
    // If bot goes first, trigger immediately
    if (initialState.currentPlayer === botPlayer) {
      setTimeout(() => get().triggerBotMove(), 100);
    }
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
          set({
            selectedRingId: ringId,
            highlightedCaptures: chains.flat(),
          });
        }
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
      get().autoSave();
      if (!winner) setTimeout(() => get().triggerBotMove(), 0);
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
    get().autoSave();
    if (!winner) setTimeout(() => get().triggerBotMove(), 0);
  },

  handleCapture: (captures) => {
    const { state, currentNode } = get();
    if (captures.length === 0) return;

    const { newState, move, previousPlayer, previousMoveNumber, winner, winType } = applyCapture(state, captures);
    const newNode = addMoveToTree(currentNode, move, previousPlayer, previousMoveNumber, state.boardSize);

    playCaptureSound();
    if (winner) playWinSound();

    set({ state: newState, currentNode: newNode, selectedRingId: null, highlightedCaptures: [], availableCaptureChains: [], winType });
    get().autoSave();
    if (!winner) setTimeout(() => get().triggerBotMove(), 0);
  },
  
  undo: () => {
    const { state, currentNode } = get();
    if (!currentNode.parent || state.winner) return;

    // Delete the state node from tree
    const parentNode = currentNode.parent;
    const idx = parentNode.children.indexOf(currentNode);
    if (idx > -1) {
      parentNode.children.splice(idx, 1);
    }
    
    // We already have rebuild logic down in navigateToNode
    get().navigateToNode(parentNode);
    playUndoSound();
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
    }

    const shouldRewind = isDescendant(node, currentNode.id);
    const targetNode = shouldRewind ? parent : currentNode;
    const newState = rebuildStateFromNode(targetNode, state.boardSize);

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
    const newState = rebuildStateFromNode(targetNode, get().state.boardSize);

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
    const { state, botPlayer, botLevel, isBotThinking } = get();
    if (!botPlayer || state.winner || isBotThinking) return;
    if (state.currentPlayer !== botPlayer) return;
    if (state.phase === 'ringRemoval') return;

    set({ isBotThinking: true });

    const worker = new Worker(new URL('../ai/worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ move: BotMove }>) => {
      worker.terminate();
      set({ isBotThinking: false });

      const { move } = e.data;
      if (get().state.winner) return;

      if (move.type === 'capture') {
        get().handleCapture(move.chain);
      } else {
        // Set marble color so handlePlacement can read it, then place
        set({ selectedMarbleColor: move.color });
        get().handlePlacement(move.ringId);
        // If ring removal is needed, handle it synchronously after state settles
        if (move.removedRingId) {
          const afterPlace = get().state;
          if (afterPlace.phase === 'ringRemoval') {
            get().handleRingRemoval(move.removedRingId);
          }
        }
      }
    };
    worker.onerror = (err) => {
      console.error('[Bot] worker error:', err);
      worker.terminate();
      set({ isBotThinking: false });
    };

    worker.postMessage({ state, botPlayer, level: botLevel });
  },

  autoSave: async () => {
    const { state, gameTree, playerNames, gameId, winType } = get();
    await saveGame(gameId, state, gameTree, playerNames, winType, false);
  },
}));
