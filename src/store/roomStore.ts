import { create } from 'zustand';
import { GameState, GameNode, MarbleColor, CaptureMove, Move, Player } from '../game/types';
import {
  createInitialState,
  cloneState,
  placeMarble,
  removeRing,
  skipRingRemoval,
  executeCapture,
  hasAvailableCaptures,
  checkWinCondition,
  getCaptureChains,
  moveToNotation,
  getWinType,
} from '../game/GameEngine';
import { getValidRemovableRings } from '../game/Board';
import * as roomsApi from '../db/roomsApi';
import { ChatMessage, FischerTimeControl, RatingDelta } from '../db/roomsApi';
import * as gamesStorage from '../db/gamesStorage';
import { playPlaceSound, playRemoveRingSound, playCaptureSound, playWinSound } from '../utils/sounds';
import { useAuthStore } from './authStore';
import { getI18nFromStorage } from '../i18n';

function getDefaultPlayerNames() {
  const { language } = getI18nFromStorage();
  if (language === 'ru') return { player1: 'Игрок 1', player2: 'Игрок 2' };
  if (language === 'eo') return { player1: 'Ludanto 1', player2: 'Ludanto 2' };
  return { player1: 'Player 1', player2: 'Player 2' };
}

function findDeepestMainLine(node: GameNode): GameNode {
  if (node.children.length === 0) return node;
  return findDeepestMainLine(node.children[0]);
}

interface RoomStore {
  // Room info
  roomId: number | null;
  myPlayer: 1 | 2 | null;
  creatorPlayer: 1 | 2 | null;
  user1Id: number | null;
  user2Id: number | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number;
  winType: string | null;

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

  // Rating
  rated: boolean;
  user1Rating: number | null;
  user2Rating: number | null;
  ratingDelta: RatingDelta | null;

  // Time control (online timed invite)
  timeControlBaseMs: number | null;
  timeControlIncrementMs: number | null;
  clockP1Ms: number | null;
  clockP2Ms: number | null;
  clockRunningSince: number | null;

  // Chat
  messages: ChatMessage[];
  lastMessageId: number;

  // Actions
  createRoom: (
    boardSize: 37 | 48 | 61,
    creatorPlayer?: 1 | 2,
    rated?: boolean,
    timeControl?: FischerTimeControl | null
  ) => Promise<number>;
  joinRoom: (roomId: number | string) => Promise<boolean>;
  pollRoom: () => Promise<void>;
  pollMessages: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  
  selectMarbleColor: (color: MarbleColor | null) => void;
  selectRing: (ringId: string | null) => void;
  handlePlacement: (ringId: string) => Promise<void>;
  handleRingRemoval: (ringId: string) => Promise<void>;
  handleCapture: (captures: CaptureMove[]) => Promise<void>;
  undoLastMove: (overrideCheck?: boolean) => Promise<void>;
  navigateToNode: (targetNode: GameNode) => void;
  setPlayerName: (player: 1 | 2, name: string) => Promise<void>;
  surrender: () => Promise<void>;
  
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

// Guard: block polling while a move is being persisted to server
let pendingMoveCount = 0;

function rebuildStateFromNode(targetNode: GameNode, boardSize: 37 | 48 | 61): GameState {
  const nextState = createInitialState(boardSize);
  const moves: GameNode[] = [];

  let node: GameNode | null = targetNode;
  while (node && node.move) {
    moves.unshift(node);
    node = node.parent;
  }

  for (const moveNode of moves) {
    if (moveNode.move?.type === 'placement') {
      const { marbleColor, ringId, removedRingId } = moveNode.move.data;
      placeMarble(nextState, ringId, marbleColor);
      if (removedRingId) {
        removeRing(nextState, removedRingId);
      } else {
        skipRingRemoval(nextState);
      }
    } else if (moveNode.move?.type === 'capture') {
      const captures = [moveNode.move.data, ...(moveNode.move.data.chain || [])];
      executeCapture(nextState, captures);
    }
  }

  return nextState;
}

function syncWinnerFromRoom(state: GameState, winnerNum: number | null): GameState {
  if (winnerNum == null) return state;
  const winnerPlayer: Player = winnerNum === 1 ? 'player1' : 'player2';
  if (state.winner === winnerPlayer) return state;
  const patched = cloneState(state);
  patched.winner = winnerPlayer;
  patched.phase = 'gameOver';
  return patched;
}

async function persistOnlineGame(
  roomId: number | null,
  state: GameState,
  tree: GameNode,
  playerNames: { player1: string; player2: string },
  winType: string | null
): Promise<void> {
  if (!roomId) return;
  await gamesStorage.saveGame(String(roomId), state, tree, playerNames, winType, true);
}

const _initialRoot = createRootNode();
export const useRoomStore = create<RoomStore>((set, get) => ({
  ...(() => {
    const defaults = getDefaultPlayerNames();
    return { playerNames: defaults };
  })(),
  roomId: null,
  myPlayer: null,
  creatorPlayer: null,
  user1Id: null,
  user2Id: null,
  isLoading: false,
  error: null,
  lastUpdated: 0,
  winType: null,

  state: createInitialState(37),
  gameTree: _initialRoot,
  currentNode: _initialRoot,

  selectedMarbleColor: null,
  selectedRingId: null,
  highlightedCaptures: [],
  availableCaptureChains: [],

  rated: false,
  user1Rating: null,
  user2Rating: null,
  ratingDelta: null,
  timeControlBaseMs: null,
  timeControlIncrementMs: null,
  clockP1Ms: null,
  clockP2Ms: null,
  clockRunningSince: null,

  messages: [],
  lastMessageId: 0,

  createRoom: async (boardSize, creatorPlayer = 1, rated = false, timeControl = null) => {
    set({ isLoading: true, error: null });
    try {
      const initialState = createInitialState(boardSize);
      const rootNode = createRootNode();

      const roomId = await roomsApi.createRoom(boardSize, initialState, rootNode, creatorPlayer, rated, timeControl);
      
      const authUser = useAuthStore.getState().user;
      const names = { ...getDefaultPlayerNames() };
      if (authUser) {
        if (creatorPlayer === 1) names.player1 = authUser.username;
        else names.player2 = authUser.username;
        await roomsApi.updatePlayerName(roomId, creatorPlayer, authUser.username);
      }

      set({
        roomId,
        myPlayer: creatorPlayer,
        creatorPlayer,
        user1Id: creatorPlayer === 1 ? authUser?.id ?? null : null,
        user2Id: creatorPlayer === 2 ? authUser?.id ?? null : null,
        state: initialState,
        gameTree: rootNode,
        currentNode: rootNode,
        playerNames: names,
        isLoading: false,
        lastUpdated: Date.now(),
        winType: null,
        timeControlBaseMs: timeControl?.baseMs ?? null,
        timeControlIncrementMs: timeControl?.incrementMs ?? null,
        clockP1Ms: timeControl?.baseMs ?? null,
        clockP2Ms: timeControl?.baseMs ?? null,
        clockRunningSince: timeControl ? Date.now() : null,
        messages: [],
        lastMessageId: 0,
      });

      await persistOnlineGame(
        roomId,
        initialState,
        rootNode,
        names,
        null
      );

      return roomId;
    } catch (err) {
      set({ error: getI18nFromStorage().t.createRoomError, isLoading: false });
      throw err;
    }
  },

  joinRoom: async (roomId) => {
    set({ isLoading: true, error: null });
    try {
      const room = await roomsApi.getRoom(roomId);
      if (!room) {
        set({ error: 'Room not found', isLoading: false });
        return false;
      }

      // Parse roomId as number if it's a string
      const numericRoomId = typeof roomId === 'string' ? parseInt(roomId, 10) : roomId;

      // Determine seat by authenticated room binding first.
      let myPlayer: 1 | 2 | null = null;

      const authUser = useAuthStore.getState().user;
      const names = { ...room.playerNames };
      if (authUser) {
        if (room.user1Id === authUser.id) {
          myPlayer = 1;
        } else if (room.user2Id === authUser.id) {
          myPlayer = 2;
        } else if (room.user1Id == null) {
          myPlayer = 1;
        } else if (room.user2Id == null) {
          myPlayer = 2;
        }

      }

      if (authUser && myPlayer) {
        if (myPlayer === 1) names.player1 = authUser.username;
        else names.player2 = authUser.username;
        await roomsApi.updatePlayerName(numericRoomId, myPlayer, authUser.username);
        // Associate user_id with the room for rated games
        try {
          const token = localStorage.getItem('zertz_auth_token');
          if (token) {
            const API_BASE = import.meta.env.VITE_API_URL || '';
            await fetch(`${API_BASE}/api/rooms/${numericRoomId}/join`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ playerIndex: myPlayer }),
            });
          }
        } catch { /* ignore join errors */ }
      }

      const syncedState = syncWinnerFromRoom(room.state, room.winner);

      set({
        roomId: numericRoomId,
        myPlayer,
        creatorPlayer: room.creatorPlayer,
        user1Id: myPlayer === 1 && authUser ? authUser.id : room.user1Id,
        user2Id: myPlayer === 2 && authUser ? authUser.id : room.user2Id,
        state: syncedState,
        gameTree: room.tree,
        currentNode: findDeepestMainLine(room.tree),
        playerNames: names,
        isLoading: false,
        lastUpdated: room.updatedAt,
        winType: room.winType,
        rated: room.rated,
        user1Rating: room.user1Rating,
        user2Rating: room.user2Rating,
        ratingDelta: room.ratingDelta,
        timeControlBaseMs: room.timeControlBaseMs,
        timeControlIncrementMs: room.timeControlIncrementMs,
        clockP1Ms: room.clockP1Ms,
        clockP2Ms: room.clockP2Ms,
        clockRunningSince: room.clockRunningSince,
      });

      await persistOnlineGame(numericRoomId, syncedState, room.tree, names, room.winType);

      // Load chat messages
      const messages = await roomsApi.getChatMessages(roomId);
      set({
        messages,
        lastMessageId: messages.length > 0 ? messages[messages.length - 1].id : 0,
      });

      return true;
    } catch (err) {
      set({ error: 'Failed to join room', isLoading: false });
      return false;
    }
  },

  pollRoom: async () => {
    const { roomId } = get();
    if (!roomId || pendingMoveCount > 0) return;

    try {
      const room = await roomsApi.getRoom(roomId);
      if (!room || pendingMoveCount > 0) return;

      // Re-read lastUpdated after fetch to avoid stale comparison
      const { lastUpdated } = get();
      if (room.updatedAt > lastUpdated) {
        const syncedState = syncWinnerFromRoom(room.state, room.winner);

        set({
          state: syncedState,
          gameTree: room.tree,
          currentNode: findDeepestMainLine(room.tree),
          playerNames: room.playerNames,
          user1Id: room.user1Id,
          user2Id: room.user2Id,
          lastUpdated: room.updatedAt,
          winType: room.winType,
          selectedMarbleColor: null,
          selectedRingId: null,
          highlightedCaptures: [],
          rated: room.rated,
          user1Rating: room.user1Rating,
          user2Rating: room.user2Rating,
          ratingDelta: room.ratingDelta || get().ratingDelta,
          timeControlBaseMs: room.timeControlBaseMs,
          timeControlIncrementMs: room.timeControlIncrementMs,
          clockP1Ms: room.clockP1Ms,
          clockP2Ms: room.clockP2Ms,
          clockRunningSince: room.clockRunningSince,
        });
        await persistOnlineGame(roomId, syncedState, room.tree, room.playerNames, room.winType);
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
    const { roomId, myPlayer, state } = get();
    if (!roomId || !myPlayer || !text.trim()) return;

    try {
      const message = await roomsApi.sendChatMessage(roomId, myPlayer, text.trim(), state.moveNumber);
      set(s => ({
        messages: [...s.messages, message],
        lastMessageId: message.id,
      }));
    } catch {
      // Ignore send errors
    }
  },

  selectMarbleColor: (color) => {
    const { myPlayer, state } = get();
    if (!myPlayer) return;
    const myPlayerStr = myPlayer === 1 ? 'player1' : 'player2';
    if (state.currentPlayer !== myPlayerStr) return; // Not my turn
    set({ selectedMarbleColor: color, selectedRingId: null, highlightedCaptures: [] });
  },

  selectRing: (ringId) => {
    const { state, myPlayer } = get();
    if (!myPlayer) return;
    const myPlayerStr = myPlayer === 1 ? 'player1' : 'player2';
    if (state.currentPlayer !== myPlayerStr) return; // Not my turn
    if (!ringId) {
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
    const { state, selectedMarbleColor, roomId, currentNode, gameTree, playerNames, myPlayer } = get();
    if (!selectedMarbleColor || !roomId || !myPlayer) return;
    // Turn enforcement
    const myPlayerStr = myPlayer === 1 ? 'player1' : 'player2';
    if (state.currentPlayer !== myPlayerStr) return;

    pendingMoveCount++;
    try {
      const newState = cloneState(state);
      const placeResult = placeMarble(newState, ringId, selectedMarbleColor);
      console.log('[roomStore.handlePlacement] placeMarble result:', placeResult);
      if (!placeResult) return;

      playPlaceSound();

      const move: Move = {
        type: 'placement',
        data: { marbleColor: selectedMarbleColor, ringId, removedRingId: null },
      };

      const validRemovable = getValidRemovableRings(newState.rings);
      console.log('[roomStore.handlePlacement] validRemovable:', validRemovable.length);

      if (validRemovable.length === 0) {
        // No free rings to remove — skip ring removal and complete the turn
        skipRingRemoval(newState);

        if (hasAvailableCaptures(newState)) {
          newState.phase = 'capture';
        }

        const winner = checkWinCondition(newState);
        const winType = winner ? getWinType(newState, winner) : null;
        if (winner) {
          playWinSound();
          newState.winner = winner;
        }

        const newNode = addMoveToTree(currentNode, move, state.currentPlayer, state.moveNumber, state.boardSize);

        set({
          state: newState,
          currentNode: newNode,
          selectedMarbleColor: null,
          selectedRingId: null,
          winType,
        });

        const winnerNum = winner === 'player1' ? 1 : winner === 'player2' ? 2 : null;
        const currentPlayerNum = newState.currentPlayer === 'player1' ? 1 : 2;
        const result = await roomsApi.updateRoomState(roomId, newState, gameTree, currentPlayerNum as 1 | 2, winnerNum, winType, myPlayer || undefined);
        if (result.ratingDelta) set({ ratingDelta: result.ratingDelta });
        await persistOnlineGame(roomId, newState, gameTree, playerNames, winType);
      } else {
        // Normal case: wait for ring removal
        const newNode = addMoveToTree(currentNode, move, state.currentPlayer, state.moveNumber, state.boardSize);

        set({
          state: newState,
          currentNode: newNode,
          selectedMarbleColor: null,
          selectedRingId: null,
          winType: null,
        });

        const currentPlayerNum = state.currentPlayer === 'player1' ? 1 : 2;
        await roomsApi.updateRoomState(roomId, newState, gameTree, currentPlayerNum as 1 | 2, null, null, myPlayer || undefined);
        await persistOnlineGame(roomId, newState, gameTree, playerNames, null);
      }
    } catch (err) {
      console.error('[roomStore.handlePlacement] ERROR:', err);
    } finally {
      pendingMoveCount--;
    }
  },

  handleRingRemoval: async (ringId) => {
    const { state, roomId, currentNode, gameTree, playerNames, myPlayer } = get();
    if (!roomId || !myPlayer) return;
    // Turn enforcement (ring removal is still current player's turn)
    const myPlayerStrRR = myPlayer === 1 ? 'player1' : 'player2';
    if (state.currentPlayer !== myPlayerStrRR) return;

    const validRings = getValidRemovableRings(state.rings);
    if (!validRings.includes(ringId)) return;

    pendingMoveCount++;
    try {
      const newState = cloneState(state);
      if (!removeRing(newState, ringId)) return;

      playRemoveRingSound();

      // Update the previous placement move with the removed ring
      if (currentNode.move && currentNode.move.type === 'placement') {
        currentNode.move.data.removedRingId = ringId;
        currentNode.notation = moveToNotation(currentNode.move, state.boardSize);
      }

      // Check if new player has mandatory captures
      if (hasAvailableCaptures(newState)) {
        newState.phase = 'capture';
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
        winType,
      });

      const winnerNum = winner === 'player1' ? 1 : winner === 'player2' ? 2 : null;
      const currentPlayerNum = newState.currentPlayer === 'player1' ? 1 : 2;
      const result = await roomsApi.updateRoomState(roomId, newState, gameTree, currentPlayerNum as 1 | 2, winnerNum, winType, myPlayer || undefined);
      if (result.ratingDelta) set({ ratingDelta: result.ratingDelta });
      await persistOnlineGame(roomId, newState, gameTree, playerNames, winType);
    } catch (err) {
      console.error('[roomStore.handleRingRemoval] ERROR:', err);
    } finally {
      pendingMoveCount--;
    }
  },

  handleCapture: async (captures) => {
    const { state, roomId, currentNode, gameTree, playerNames, myPlayer } = get();
    if (!roomId || !myPlayer) return;
    // Turn enforcement
    const myPlayerStrC = myPlayer === 1 ? 'player1' : 'player2';
    if (state.currentPlayer !== myPlayerStrC) return;

    pendingMoveCount++;
    try {
      const newState = cloneState(state);
      const previousPlayer = state.currentPlayer;
      const previousMoveNumber = state.moveNumber;

      executeCapture(newState, captures);
      playCaptureSound();

      // Check if new player has mandatory captures
      if (hasAvailableCaptures(newState)) {
        newState.phase = 'capture';
      } else {
        newState.phase = 'placement';
      }

      const winner = checkWinCondition(newState);
      const winType = winner ? getWinType(newState, winner) : null;

      if (winner) {
        playWinSound();
        newState.winner = winner;
      }

      const move: Move = {
        type: 'capture',
        data: {
          ...captures[0],
          chain: captures.slice(1),
        },
      };

      const newNode = addMoveToTree(currentNode, move, previousPlayer, previousMoveNumber, state.boardSize);

      set({
        state: newState,
        currentNode: newNode,
        selectedRingId: null,
        highlightedCaptures: [],
        availableCaptureChains: [],
        winType,
      });

      const winnerNum = winner === 'player1' ? 1 : winner === 'player2' ? 2 : null;
      const currentPlayerNum = newState.currentPlayer === 'player1' ? 1 : 2;
      const result = await roomsApi.updateRoomState(roomId, newState, gameTree, currentPlayerNum as 1 | 2, winnerNum, winType, myPlayer || undefined);
      if (result.ratingDelta) set({ ratingDelta: result.ratingDelta });
      await persistOnlineGame(roomId, newState, gameTree, playerNames, winType);
    } catch (err) {
      console.error('[roomStore.handleCapture] ERROR:', err);
    } finally {
      pendingMoveCount--;
    }
  },

  undoLastMove: async (overrideCheck = false) => {
    const { roomId, currentNode, state, gameTree, playerNames, myPlayer } = get();
    if (!roomId || !myPlayer || !currentNode.parent) return;
    const myPlayerStr = myPlayer === 1 ? 'player1' : 'player2';
    if (!overrideCheck && currentNode.player !== myPlayerStr) return;

    pendingMoveCount++;
    try {
      const parentNode = currentNode.parent;
      const idx = parentNode.children.indexOf(currentNode);
      if (idx >= 0) {
        parentNode.children.splice(idx, 1);
      }

      const newState = rebuildStateFromNode(parentNode, state.boardSize);
      const winner = newState.winner;
      const winType = winner ? getWinType(newState, winner) : null;

      set({
        state: newState,
        currentNode: parentNode,
        selectedMarbleColor: null,
        selectedRingId: null,
        highlightedCaptures: [],
        availableCaptureChains: [],
        winType,
      });

      const winnerNum = winner === 'player1' ? 1 : winner === 'player2' ? 2 : null;
      const currentPlayerNum = newState.currentPlayer === 'player1' ? 1 : 2;
      await roomsApi.updateRoomState(roomId, newState, gameTree, currentPlayerNum as 1 | 2, winnerNum, winType, myPlayer);
      await persistOnlineGame(roomId, newState, gameTree, playerNames, winType);
    } catch (err) {
      console.error('[roomStore.undoLastMove] ERROR:', err);
    } finally {
      pendingMoveCount--;
    }
  },

  navigateToNode: (targetNode) => {
    const { state } = get();
    const newState = rebuildStateFromNode(targetNode, state.boardSize);

    set({
      state: newState,
      currentNode: targetNode,
      selectedMarbleColor: null,
      selectedRingId: null,
      highlightedCaptures: [],
      availableCaptureChains: [],
    });
  },

  setPlayerName: async (player, name) => {
    const { roomId, playerNames, state, gameTree } = get();
    if (!roomId) return;

    const newNames = { ...playerNames };
    if (player === 1) newNames.player1 = name;
    else newNames.player2 = name;

    set({ playerNames: newNames });
    await roomsApi.updatePlayerName(roomId, player, name);
    await persistOnlineGame(roomId, state, gameTree, newNames, null);
  },

  surrender: async () => {
    const { roomId, state, gameTree, myPlayer, playerNames } = get();
    if (!roomId || !myPlayer || state.winner) return;

    pendingMoveCount++;
    try {
      const newState = cloneState(state);
      const winnerPlayer = myPlayer === 1 ? 'player2' : 'player1';
      newState.winner = winnerPlayer;
      const winType = 'surrender';

      set({
        state: newState,
        winType,
      });

      const winnerNum = winnerPlayer === 'player1' ? 1 : 2;
      const currentPlayerNum = newState.currentPlayer === 'player1' ? 1 : 2;
      const result = await roomsApi.updateRoomState(roomId, newState, gameTree, currentPlayerNum as 1 | 2, winnerNum, winType, myPlayer);
      if (result.ratingDelta) set({ ratingDelta: result.ratingDelta });
      await persistOnlineGame(roomId, newState, gameTree, playerNames, winType);
    } catch (err) {
      console.error('[roomStore.surrender] ERROR:', err);
    } finally {
      pendingMoveCount--;
    }
  },

  reset: () => {
    const rootNode = createRootNode();
    set({
      roomId: null,
      myPlayer: null,
      creatorPlayer: null,
      user1Id: null,
      user2Id: null,
      isLoading: false,
      error: null,
      lastUpdated: 0,
      state: createInitialState(37),
      gameTree: rootNode,
      currentNode: rootNode,
      playerNames: getDefaultPlayerNames(),
      selectedMarbleColor: null,
      selectedRingId: null,
      highlightedCaptures: [],
      availableCaptureChains: [],
      winType: null,
      rated: false,
      user1Rating: null,
      user2Rating: null,
      ratingDelta: null,
      timeControlBaseMs: null,
      timeControlIncrementMs: null,
      clockP1Ms: null,
      clockP2Ms: null,
      clockRunningSince: null,
      messages: [],
      lastMessageId: 0,
    });
  },
}));
