import { create } from 'zustand';
import {
  GameState,
  MarbleColor,
  CaptureMove,
  GameNode,
  Move,
} from '../game/types';
import {
  createInitialState,
  cloneState,
  placeMarble,
  removeRing,
  executeCapture,
  hasAvailableCaptures,
  checkWinCondition,
  skipRingRemoval,
  getCaptureChains,
  getWinType,
} from '../game/GameEngine';
import { getValidRemovableRings } from '../game/Board';
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
  
  newGame: (boardSize?: 37 | 48 | 61) => void;
  selectMarbleColor: (color: MarbleColor | null) => void;
  selectRing: (ringId: string) => void;
  handlePlacement: (ringId: string) => void;
  handleRingRemoval: (ringId: string) => void;
  handleCapture: (capture: CaptureMove[]) => void;
  undo: () => void;
  surrender: () => void;
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
    });
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
    
    const newState = cloneState(state);
    const success = placeMarble(newState, ringId, selectedMarbleColor);
    
    if (success) {
      const validRemovable = getValidRemovableRings(newState.rings);
      
      if (validRemovable.length === 0) {
        skipRingRemoval(newState);
        
        const move: Move = {
          type: 'placement',
          data: {
            marbleColor: selectedMarbleColor,
            ringId,
            removedRingId: null,
          },
        };
        
        const newNode = addMoveToTree(
          currentNode,
          move,
          state.currentPlayer,
          state.moveNumber,
          state.boardSize
        );
        
        const winner = checkWinCondition(newState);
        let nextWinType: string | null = null;
        if (winner) {
          newState.winner = winner;
          newState.phase = 'gameOver';
          nextWinType = getWinType(newState, winner);
        }
        
        playPlaceSound();
        if (winner) playWinSound();
        
        set({
          state: newState,
          currentNode: newNode,
          selectedMarbleColor: null,
          selectedRingId: null,
          winType: nextWinType,
        });
        
        // Auto-save after move
        get().autoSave();
      } else {
        playPlaceSound();
        set({
          state: newState,
          selectedMarbleColor: null,
        });
      }
    }
  },
  
  handleRingRemoval: (ringId) => {
    const { state, currentNode } = get();
    if (state.phase !== 'ringRemoval' || !state.pendingPlacement) return;
    
    const pendingPlacement = state.pendingPlacement;
    const newState = cloneState(state);
    const success = removeRing(newState, ringId);
    
    if (success) {
      const move: Move = {
        type: 'placement',
        data: {
          marbleColor: pendingPlacement.marbleColor,
          ringId: pendingPlacement.ringId,
          removedRingId: ringId,
        },
      };
      
      const previousPlayer = state.currentPlayer;
      const previousMoveNumber = state.moveNumber;
      
      const newNode = addMoveToTree(
        currentNode,
        move,
        previousPlayer,
        previousMoveNumber,
        state.boardSize
      );
      
      playRemoveRingSound();
      
      let nextWinType: string | null = null;
      const winner = checkWinCondition(newState);
      if (winner) {
        newState.winner = winner;
        newState.phase = 'gameOver';
        nextWinType = getWinType(newState, winner);
        playWinSound();
      }
      
      set({
        state: newState,
        currentNode: newNode,
        selectedRingId: null,
        winType: nextWinType,
      });
      
      // Auto-save after move
      get().autoSave();
    }
  },
  
  handleCapture: (captures) => {
    const { state, currentNode } = get();
    if (captures.length === 0) return;
    
    const newState = cloneState(state);
    const previousPlayer = state.currentPlayer;
    const previousMoveNumber = state.moveNumber;
    
    executeCapture(newState, captures);
    
    const move: Move = {
      type: 'capture',
      data: {
        ...captures[0],
        chain: captures.slice(1),
      },
    };
    
    const newNode = addMoveToTree(
      currentNode,
      move,
      previousPlayer,
      previousMoveNumber,
      state.boardSize
    );
    
    playCaptureSound();
    
    let nextWinType: string | null = null;
    const winner = checkWinCondition(newState);
    if (winner) {
      newState.winner = winner;
      newState.phase = 'gameOver';
      nextWinType = getWinType(newState, winner);
      playWinSound();
    }
    
    set({
      state: newState,
      currentNode: newNode,
      selectedRingId: null,
      highlightedCaptures: [],
      availableCaptureChains: [],
      winType: nextWinType,
    });
    
    // Auto-save after move
    get().autoSave();
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
  
  autoSave: async () => {
    const { state, gameTree, playerNames, gameId, winType } = get();
    await saveGame(gameId, state, gameTree, playerNames, winType, false);
  },
}));
