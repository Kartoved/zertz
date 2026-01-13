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
  placeMarble,
  removeRing,
  executeCapture,
  hasAvailableCaptures,
  checkWinCondition,
  skipRingRemoval,
  getCaptureChains,
  moveToNotation,
  getWinType,
} from '../game/GameEngine';
import { getValidRemovableRings, idToAlgebraic } from '../game/Board';
import { saveGame, loadGame, listGames } from '../db/indexedDB';
import { playPlaceSound, playRemoveRingSound, playCaptureSound, playWinSound, playUndoSound } from '../utils/sounds';

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
  savedGames: Array<{ id: string; playerNames: { player1: string; player2: string }; updatedAt: number; moveCount: number; winner: string | null }>;
  winType: string | null;
  
  newGame: () => void;
  selectMarbleColor: (color: MarbleColor | null) => void;
  selectRing: (ringId: string) => void;
  handlePlacement: (ringId: string) => void;
  handleRingRemoval: (ringId: string) => void;
  handleCapture: (capture: CaptureMove[]) => void;
  undo: () => void;
  setPlayerNames: (player1: string, player2: string) => void;
  loadSavedGame: (id: string) => Promise<void>;
  refreshSavedGames: () => Promise<void>;
  getMarbleColorAt: (ringId: string) => MarbleColor | null;
  navigateToNode: (node: GameNode) => void;
  autoSave: () => Promise<void>;
}

function createRootNode(): GameNode {
  return {
    id: 'root',
    moveNumber: 0,
    player: 'player1',
    move: null,
    notation: '',
    children: [],
    parent: null,
    isMainLine: true,
  };
}

function addMoveToTree(
  currentNode: GameNode,
  move: Move,
  player: Player,
  moveNumber: number
): GameNode {
  const newNode: GameNode = {
    id: `${moveNumber}-${Date.now()}`,
    moveNumber,
    player,
    move,
    notation: moveToNotation(move),
    children: [],
    parent: currentNode,
    isMainLine: currentNode.children.length === 0,
  };
  
  currentNode.children.push(newNode);
  return newNode;
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: createInitialState(),
  gameTree: createRootNode(),
  currentNode: createRootNode(),
  selectedMarbleColor: null,
  selectedRingId: null,
  highlightedCaptures: [],
  availableCaptureChains: [],
  playerNames: { player1: 'Игрок 1', player2: 'Игрок 2' },
  gameId: `game-${Date.now()}`,
  savedGames: [],
  winType: null,
  
  newGame: () => {
    const rootNode = createRootNode();
    const newGameId = `game-${Date.now()}`;
    set({
      state: createInitialState(),
      gameTree: rootNode,
      currentNode: rootNode,
      selectedMarbleColor: null,
      selectedRingId: null,
      highlightedCaptures: [],
      availableCaptureChains: [],
      gameId: newGameId,
      winType: null,
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
          state.moveNumber
        );
        
        const winner = checkWinCondition(newState);
        if (winner) {
          newState.winner = winner;
          newState.phase = 'gameOver';
        }
        
        playPlaceSound();
        if (winner) playWinSound();
        
        set({
          state: newState,
          currentNode: newNode,
          selectedMarbleColor: null,
          selectedRingId: null,
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
        previousMoveNumber
      );
      
      playRemoveRingSound();
      
      const winner = checkWinCondition(newState);
      if (winner) {
        newState.winner = winner;
        newState.phase = 'gameOver';
        playWinSound();
      }
      
      set({
        state: newState,
        currentNode: newNode,
        selectedRingId: null,
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
      previousMoveNumber
    );
    
    playCaptureSound();
    
    const winner = checkWinCondition(newState);
    if (winner) {
      newState.winner = winner;
      newState.phase = 'gameOver';
      playWinSound();
    }
    
    set({
      state: newState,
      currentNode: newNode,
      selectedRingId: null,
      highlightedCaptures: [],
      availableCaptureChains: [],
    });
    
    // Auto-save after move
    get().autoSave();
  },
  
  undo: () => {
    const { currentNode, gameTree } = get();
    if (currentNode.parent) {
      const parentNode = currentNode.parent;
      const idx = parentNode.children.indexOf(currentNode);
      if (idx > -1) {
        parentNode.children.splice(idx, 1);
      }
      
      let newState = createInitialState();
      let node: GameNode | null = parentNode;
      const moves: GameNode[] = [];
      
      while (node && node.move) {
        moves.unshift(node);
        node = node.parent;
      }
      
      for (const moveNode of moves) {
        if (moveNode.move?.type === 'placement') {
          const { marbleColor, ringId, removedRingId } = moveNode.move.data;
          placeMarble(newState, ringId, marbleColor);
          if (removedRingId) {
            removeRing(newState, removedRingId);
          } else {
            skipRingRemoval(newState);
          }
        } else if (moveNode.move?.type === 'capture') {
          const captures = [moveNode.move.data, ...(moveNode.move.data.chain || [])];
          executeCapture(newState, captures);
        }
      }
      
      playUndoSound();
      
      set({
        state: newState,
        currentNode: parentNode,
        selectedMarbleColor: null,
        selectedRingId: null,
        highlightedCaptures: [],
      });
    }
  },
  
  setPlayerNames: (player1, player2) => {
    set({ playerNames: { player1, player2 } });
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
        winType: saved.state.winner ? getWinType(saved.state, saved.state.winner) : null,
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
    // Rebuild state by replaying moves from root to targetNode
    let newState = createInitialState();
    const moves: GameNode[] = [];
    let node: GameNode | null = targetNode;
    
    // Collect path from targetNode to root
    while (node && node.move) {
      moves.unshift(node);
      node = node.parent;
    }
    
    // Replay all moves
    for (const moveNode of moves) {
      if (moveNode.move?.type === 'placement') {
        const { marbleColor, ringId, removedRingId } = moveNode.move.data;
        placeMarble(newState, ringId, marbleColor);
        if (removedRingId) {
          removeRing(newState, removedRingId);
        } else {
          skipRingRemoval(newState);
        }
      } else if (moveNode.move?.type === 'capture') {
        const captures = [moveNode.move.data, ...(moveNode.move.data.chain || [])];
        executeCapture(newState, captures);
      }
    }
    
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
    const { state, gameTree, playerNames, gameId } = get();
    await saveGame(gameId, state, gameTree, playerNames);
  },
}));
