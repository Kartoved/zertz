import { create } from 'zustand';
import { GameState, GameNode, MarbleColor, CaptureMove, Move, Player } from '../game/types';
import {
  createInitialState,
  cloneState,
  placeMarble,
  removeRing,
  executeCapture,
  hasAvailableCaptures,
  checkWinCondition,
  getCaptureChains,
  moveToNotation,
  getWinType,
} from '../game/GameEngine';
import { getValidRemovableRings } from '../game/Board';
import * as roomsApi from '../db/roomsApi';
import { ChatMessage } from '../db/roomsApi';
import { playPlaceSound, playRemoveRingSound, playCaptureSound, playWinSound } from '../utils/sounds';

interface RoomStore {
  // Room info
  roomId: number | null;
  myPlayer: 1 | 2 | null;
  creatorPlayer: 1 | 2 | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number;

  // Game state
  state: GameState;
  gameTree: GameNode;
  currentNode: GameNode;
  playerNames: { player1: string; player2: string };

  // UI state
  selectedMarbleColor: MarbleColor | null;
  selectedRingId: string | null;
  highlightedCaptures: CaptureMove[];
  availableCaptureChains: CaptureMove[][];

  // Chat
  messages: ChatMessage[];
  lastMessageId: number;

  // Actions
  createRoom: (boardSize: 37 | 48 | 61, creatorPlayer?: 1 | 2) => Promise<number>;
  joinRoom: (roomId: number | string) => Promise<boolean>;
  pollRoom: () => Promise<void>;
  pollMessages: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  
  selectMarbleColor: (color: MarbleColor | null) => void;
  selectRing: (ringId: string | null) => void;
  handlePlacement: (ringId: string) => Promise<void>;
  handleRingRemoval: (ringId: string) => Promise<void>;
  handleCapture: (captures: CaptureMove[]) => Promise<void>;
  setPlayerName: (player: 1 | 2, name: string) => Promise<void>;
  
  reset: () => void;
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
  moveNumber: number,
  boardSize: 37 | 48 | 61
): GameNode {
  const newNode: GameNode = {
    id: `${moveNumber}-${Date.now()}`,
    moveNumber,
    player,
    move,
    notation: moveToNotation(move, boardSize),
    children: [],
    parent: currentNode,
    isMainLine: currentNode.children.length === 0,
  };
  currentNode.children.push(newNode);
  return newNode;
}

export const useRoomStore = create<RoomStore>((set, get) => ({
  roomId: null,
  myPlayer: null,
  creatorPlayer: null,
  isLoading: false,
  error: null,
  lastUpdated: 0,

  state: createInitialState(37),
  gameTree: createRootNode(),
  currentNode: createRootNode(),
  playerNames: { player1: 'Игрок 1', player2: 'Игрок 2' },

  selectedMarbleColor: null,
  selectedRingId: null,
  highlightedCaptures: [],
  availableCaptureChains: [],

  messages: [],
  lastMessageId: 0,

  createRoom: async (boardSize, creatorPlayer = 1) => {
    set({ isLoading: true, error: null });
    try {
      const initialState = createInitialState(boardSize);
      const rootNode = createRootNode();

      const roomId = await roomsApi.createRoom(boardSize, initialState, rootNode, creatorPlayer);
      
      set({
        roomId,
        myPlayer: creatorPlayer,
        creatorPlayer,
        state: initialState,
        gameTree: rootNode,
        currentNode: rootNode,
        playerNames: { player1: 'Игрок 1', player2: 'Игрок 2' },
        isLoading: false,
        lastUpdated: Date.now(),
        messages: [],
        lastMessageId: 0,
      });

      return roomId;
    } catch (err) {
      set({ error: 'Не удалось создать комнату', isLoading: false });
      throw err;
    }
  },

  joinRoom: async (roomId) => {
    set({ isLoading: true, error: null });
    try {
      const room = await roomsApi.getRoom(roomId);
      if (!room) {
        set({ error: 'Комната не найдена', isLoading: false });
        return false;
      }

      // Parse roomId as number if it's a string
      const numericRoomId = typeof roomId === 'string' ? parseInt(roomId, 10) : roomId;

      // Determine which player we are (opposite of creator, or use existing)
      const myPlayer = get().myPlayer || (room.creatorPlayer === 1 ? 2 : 1);

      set({
        roomId: numericRoomId,
        myPlayer,
        creatorPlayer: room.creatorPlayer,
        state: room.state,
        gameTree: room.tree,
        currentNode: room.tree,
        playerNames: room.playerNames,
        isLoading: false,
        lastUpdated: room.updatedAt,
      });

      // Load chat messages
      const messages = await roomsApi.getChatMessages(roomId);
      set({
        messages,
        lastMessageId: messages.length > 0 ? messages[messages.length - 1].id : 0,
      });

      return true;
    } catch (err) {
      set({ error: 'Не удалось присоединиться к комнате', isLoading: false });
      return false;
    }
  },

  pollRoom: async () => {
    const { roomId, lastUpdated } = get();
    if (!roomId) return;

    try {
      const room = await roomsApi.getRoom(roomId);
      if (!room) return;

      // Only update if there are changes
      if (room.updatedAt > lastUpdated) {
        set({
          state: room.state,
          gameTree: room.tree,
          currentNode: room.tree,
          playerNames: room.playerNames,
          lastUpdated: room.updatedAt,
          selectedMarbleColor: null,
          selectedRingId: null,
          highlightedCaptures: [],
        });
      }
    } catch {
      // Ignore polling errors
    }
  },

  pollMessages: async () => {
    const { roomId, lastMessageId } = get();
    if (!roomId) return;

    try {
      const newMessages = await roomsApi.getChatMessages(roomId, lastMessageId);
      if (newMessages.length > 0) {
        set(s => ({
          messages: [...s.messages, ...newMessages],
          lastMessageId: newMessages[newMessages.length - 1].id,
        }));
      }
    } catch {
      // Ignore polling errors
    }
  },

  sendMessage: async (text) => {
    const { roomId, myPlayer } = get();
    if (!roomId || !myPlayer || !text.trim()) return;

    try {
      const message = await roomsApi.sendChatMessage(roomId, myPlayer, text.trim());
      set(s => ({
        messages: [...s.messages, message],
        lastMessageId: message.id,
      }));
    } catch {
      // Ignore send errors
    }
  },

  selectMarbleColor: (color) => {
    set({ selectedMarbleColor: color, selectedRingId: null, highlightedCaptures: [] });
  },

  selectRing: (ringId) => {
    const { state, myPlayer } = get();
    const myPlayerStr = myPlayer === 1 ? 'player1' : 'player2';
    if (!ringId || state.currentPlayer !== myPlayerStr) {
      set({ selectedRingId: null, highlightedCaptures: [], availableCaptureChains: [] });
      return;
    }

    const ring = state.rings.get(ringId);
    if (!ring || ring.isRemoved) return;

    if (state.phase === 'capture' && ring.marble) {
      const chains = getCaptureChains(state, ringId);
      if (chains.length > 0) {
        set({
          selectedRingId: ringId,
          highlightedCaptures: chains.flat(),
          availableCaptureChains: chains,
        });
      }
    } else if (state.phase === 'placement' && !ring.marble) {
      set({ selectedRingId: ringId, highlightedCaptures: [] });
    }
  },

  handlePlacement: async (ringId) => {
    const { state, selectedMarbleColor, roomId, gameTree, myPlayer } = get();
    const myPlayerStr = myPlayer === 1 ? 'player1' : 'player2';
    if (!selectedMarbleColor || !roomId || state.currentPlayer !== myPlayerStr) return;

    const newState = cloneState(state);
    if (placeMarble(newState, ringId, selectedMarbleColor)) {
      playPlaceSound();

      const move: Move = {
        type: 'placement',
        data: { marbleColor: selectedMarbleColor, ringId, removedRingId: null },
      };

      const newNode = addMoveToTree(gameTree, move, state.currentPlayer, state.moveNumber + 1, state.boardSize);

      set({
        state: newState,
        gameTree: newNode,
        currentNode: newNode,
        selectedMarbleColor: null,
        selectedRingId: null,
      });

      const currentPlayerNum = state.currentPlayer === 'player1' ? 1 : 2;
      await roomsApi.updateRoomState(roomId, newState, newNode, currentPlayerNum as 1 | 2, null, null);
    }
  },

  handleRingRemoval: async (ringId) => {
    const { state, roomId, gameTree, myPlayer } = get();
    const myPlayerStr = myPlayer === 1 ? 'player1' : 'player2';
    if (!roomId || state.currentPlayer !== myPlayerStr) return;

    const validRings = getValidRemovableRings(state.rings);
    if (!validRings.includes(ringId)) return;

    const newState = cloneState(state);
    if (removeRing(newState, ringId)) {
      playRemoveRingSound();

      // Update the previous placement move with the removed ring
      if (gameTree.move && gameTree.move.type === 'placement') {
        gameTree.move.data.removedRingId = ringId;
        gameTree.notation = moveToNotation(gameTree.move, state.boardSize);
      }

      const winner = checkWinCondition(newState);
      const winType = winner ? getWinType(newState, winner) : null;

      if (winner) {
        playWinSound();
        newState.winner = winner;
      }

      set({
        state: newState,
        selectedRingId: null,
      });

      const winnerNum = winner === 'player1' ? 1 : winner === 'player2' ? 2 : null;
      const currentPlayerNum = newState.currentPlayer === 'player1' ? 1 : 2;
      await roomsApi.updateRoomState(roomId, newState, gameTree, currentPlayerNum as 1 | 2, winnerNum, winType);
    }
  },

  handleCapture: async (captures) => {
    const { state, roomId, gameTree, myPlayer } = get();
    const myPlayerStr = myPlayer === 1 ? 'player1' : 'player2';
    if (!roomId || state.currentPlayer !== myPlayerStr) return;

    const newState = cloneState(state);
    executeCapture(newState, captures);
    playCaptureSound();

    // Check for continued captures
    if (hasAvailableCaptures(newState)) {
      newState.phase = 'capture';
    } else {
      newState.phase = 'placement';
      newState.currentPlayer = newState.currentPlayer === 'player1' ? 'player2' : 'player1';
    }

    const winner = checkWinCondition(newState);
    const winType = winner ? getWinType(newState, winner) : null;

    if (winner) {
      playWinSound();
      newState.winner = winner;
    }

    // Create move for the first capture in the chain
    const move: Move = {
      type: 'capture',
      data: captures[0],
    };

    const newNode = addMoveToTree(gameTree, move, state.currentPlayer, state.moveNumber + 1, state.boardSize);

    set({
      state: newState,
      gameTree: newNode,
      currentNode: newNode,
      selectedRingId: null,
      highlightedCaptures: [],
      availableCaptureChains: [],
    });

    const winnerNum = winner === 'player1' ? 1 : winner === 'player2' ? 2 : null;
    const currentPlayerNum = newState.currentPlayer === 'player1' ? 1 : 2;
    await roomsApi.updateRoomState(roomId, newState, newNode, currentPlayerNum as 1 | 2, winnerNum, winType);
  },

  setPlayerName: async (player, name) => {
    const { roomId, playerNames } = get();
    if (!roomId) return;

    const newNames = { ...playerNames };
    if (player === 1) newNames.player1 = name;
    else newNames.player2 = name;

    set({ playerNames: newNames });
    await roomsApi.updatePlayerName(roomId, player, name);
  },

  reset: () => {
    set({
      roomId: null,
      myPlayer: null,
      creatorPlayer: null,
      isLoading: false,
      error: null,
      lastUpdated: 0,
      state: createInitialState(37),
      gameTree: createRootNode(),
      currentNode: createRootNode(),
      playerNames: { player1: 'Игрок 1', player2: 'Игрок 2' },
      selectedMarbleColor: null,
      selectedRingId: null,
      highlightedCaptures: [],
      availableCaptureChains: [],
      messages: [],
      lastMessageId: 0,
    });
  },
}));
