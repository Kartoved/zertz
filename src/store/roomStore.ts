import { create } from 'zustand';
import { GameState, GameNode, MarbleColor, CaptureMove, Move, Player, PreMoveTree, PreMoveNotice } from '../game/types';
import {
  createInitialState,
  cloneState,
  hasAvailableCaptures,
  getCaptureChains,
  getWinType,
} from '../game/GameEngine';
import { getValidRemovableRings } from '../game/Board';
import { applyPlacement, applyRingRemoval, applyCapture, normalizePhase } from '../utils/moveActions';
import * as roomsApi from '../db/roomsApi';
import { ChatMessage, FischerTimeControl, RatingDelta } from '../db/roomsApi';
import * as premovesApi from '../db/premovesApi';
import * as gamesStorage from '../db/gamesStorage';
import { playPlaceSound, playRemoveRingSound, playCaptureSound, playWinSound } from '../utils/sounds';
import { useAuthStore } from './authStore';
import { getI18nFromStorage } from '../i18n';
import { API_BASE, authHeaders, serializeTree, deserializeTree } from '../db/apiClient';
import {
  getDefaultPlayerNames,
  createRootNode,
  addMoveToTree,
  rebuildStateFromNode,
  findDeepestMainLine,
  findNodeAndParent,
  syncMainLineFlags,
} from '../utils/gameTreeUtils';
import {
  injectPremovesIntoTree,
  computeAnalysisRingSelection,
  applyAnalysisPlacement,
  applyAnalysisRingRemoval,
  applyAnalysisCapture,
  mergeLiveTreeIntoAnalysis,
} from './analysisActions';
import { pathFromAnchor, mergePathIntoTree, removeBranch, SavePremoveResult } from './premovesActions';
import { serializeState } from '../db/apiClient';
import { loadAnalysis, saveAnalysis } from './analysisStorage';

interface RoomStore {
  // Guard: incremented while a move is being persisted to the server.
  // pollRoom checks this and skips the fetch while > 0.
  pendingMoveCount: number;

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

  // Analysis mode (for correspondence games — explore positions and plan pre-moves)
  isAnalyzing: boolean;
  analysisState: GameState | null;
  analysisGameTree: GameNode | null;
  analysisCurrentNode: GameNode | null;
  analysisStartNodeId: string | null;
  // Bumped to Date.now() each time pollRoom merges new live moves into the
  // analysis tree. The UI watches this to surface a toast.
  lastLiveMergeAt: number;
  // The current player's conditional pre-move tree (correspondence only).
  premoves: PreMoveTree | null;
  // Latest server notice about my pre-move tree (fired / pruned) — drives a toast.
  premoveNotice: PreMoveNotice | null;

  // Actions
  createRoom: (
    boardSize: 37 | 48 | 61,
    creatorPlayer?: 1 | 2,
    rated?: boolean,
    timeControl?: FischerTimeControl | null
  ) => Promise<number>;
  pendingPlayerChoice: 1 | 2 | null;
  joinRoom: (roomId: number | string, options?: { watchOnly?: boolean }) => Promise<boolean>;
  claimSeat: () => Promise<void>;
  declineSeat: () => void;
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
  cancelGame: () => Promise<void>;
  addTime: () => Promise<void>;

  // Analysis actions
  enterAnalysis: () => void;
  exitAnalysis: () => void;
  analysisSelectMarbleColor: (color: MarbleColor | null) => void;
  analysisSelectRing: (ringId: string | null) => void;
  analysisHandlePlacement: (ringId: string) => void;
  analysisHandleRingRemoval: (ringId: string) => void;
  analysisHandleCapture: (captures: CaptureMove[]) => void;
  analysisNavigateToNode: (targetNode: GameNode) => void;

  // Pre-moves actions
  loadPremoves: () => Promise<void>;
  savePremovePath: (overwrite?: boolean) => Promise<SavePremoveResult>;
  armFromOwnMove: (overwrite?: boolean) => Promise<SavePremoveResult>;
  deletePremoveBranch: (nodeId: string) => Promise<void>;
  clearPremoves: () => Promise<void>;

  reset: () => void;
}

// pendingMoveCount is now a store field — see RoomStore interface below.

function syncWinnerFromRoom(state: GameState, winnerNum: number | null): GameState {
  if (winnerNum == null || winnerNum === 0) return state; // 0 = cancelled, keep state_json winner
  const winnerPlayer: Player = winnerNum === 1 ? 'player1' : 'player2';
  if (state.winner === winnerPlayer) return state;
  const patched = cloneState(state);
  patched.winner = winnerPlayer;
  patched.phase = 'gameOver';
  return patched;
}

// Defensive phase normalizer applied to every state that arrives from the server.
// Fixes two known cases where the server can send a stale phase:
//
//  1. phase='placement' but captures are mandatory (pre-move auto-execute bug):
//     promote to 'capture'.
//
//  2. phase='ringRemoval' but no rings are actually removable (can happen when
//     the board state makes every adjacent ring occupied/invalid at the moment
//     the premove was saved, or when the server auto-executes a premove step
//     whose preceding placeMarble call left no free rings):
//     advance to 'placement' + flip currentPlayer + increment moveNumber, i.e.
//     execute the implicit skipRingRemoval.
//
// Clones only when a patch is needed; returns the original reference otherwise.
function normalizePhaseForCaptures(state: GameState): GameState {
  if (state.winner || state.phase === 'gameOver') return state;

  if (state.phase === 'ringRemoval') {
    const validRings = getValidRemovableRings(state.rings);
    if (validRings.length === 0) {
      const patched = cloneState(state);
      patched.pendingPlacement = null;
      patched.phase = 'placement';
      patched.currentPlayer = patched.currentPlayer === 'player1' ? 'player2' : 'player1';
      patched.moveNumber++;
      return patched;
    }
    return state;
  }

  if (state.phase === 'placement' && hasAvailableCaptures(state)) {
    const patched = cloneState(state);
    patched.phase = 'capture';
    return patched;
  }

  return state;
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

// Persists the user's analysis tree + cursor to localStorage. No-op for
// anonymous users (analysis is gated on login in the UI), or when there's
// nothing to save. Called after every analysis mutation so that the user can
// close the tab and resume later within the TTL.
function persistAnalysisLocal(snapshot: {
  roomId: number | null;
  analysisGameTree: GameNode | null;
  analysisCurrentNode: GameNode | null;
  analysisStartNodeId: string | null;
}): void {
  const { roomId, analysisGameTree, analysisCurrentNode, analysisStartNodeId } = snapshot;
  const userId = useAuthStore.getState().user?.id;
  if (!userId || !roomId || !analysisGameTree || !analysisCurrentNode || !analysisStartNodeId) return;
  saveAnalysis(userId, roomId, {
    tree: analysisGameTree,
    currentNodeId: analysisCurrentNode.id,
    startNodeId: analysisStartNodeId,
  });
}

const _initialRoot = createRootNode();
export const useRoomStore = create<RoomStore>((set, get) => ({
  ...(() => {
    const defaults = getDefaultPlayerNames();
    return { playerNames: defaults };
  })(),
  pendingMoveCount: 0,
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
  pendingPlayerChoice: null,

  isAnalyzing: false,
  analysisState: null,
  analysisGameTree: null,
  analysisCurrentNode: null,
  analysisStartNodeId: null,
  lastLiveMergeAt: 0,
  premoves: null,
  premoveNotice: null,

  createRoom: async (boardSize, creatorPlayer = 1, rated = true, timeControl = null) => {
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

      return roomId;
    } catch (err) {
      set({ error: getI18nFromStorage().t.createRoomError, isLoading: false });
      throw err;
    }
  },

  joinRoom: async (roomId, options) => {
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
      let pendingPlayerChoice: 1 | 2 | null = null;

      const authUser = useAuthStore.getState().user;
      const names = { ...room.playerNames };
      // Suppress seat-claim prompts when:
      //  - the caller signalled watch-only intent (e.g. user came from a games list), or
      //  - the game is already over (no point sitting down at a finished match).
      const allowSeatPrompt = !options?.watchOnly && !room.winner;
      if (authUser) {
        if (room.user1Id === authUser.id) {
          myPlayer = 1;
        } else if (room.user2Id === authUser.id) {
          myPlayer = 2;
        } else if (allowSeatPrompt && room.user1Id == null) {
          // Free seat — let user choose instead of auto-claiming
          pendingPlayerChoice = 1;
        } else if (allowSeatPrompt && room.user2Id == null) {
          // Free seat — let user choose instead of auto-claiming
          pendingPlayerChoice = 2;
        }
      }

      if (authUser && myPlayer) {
        if (myPlayer === 1) names.player1 = authUser.username;
        else names.player2 = authUser.username;
        await roomsApi.updatePlayerName(numericRoomId, myPlayer, authUser.username);
        // Associate user_id with the room for rated games
        try {
          await fetch(`${API_BASE}/api/rooms/${numericRoomId}/join`, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ playerIndex: myPlayer }),
          });
        } catch { /* ignore join errors */ }
      }

      const syncedState = normalizePhaseForCaptures(syncWinnerFromRoom(room.state, room.winner));

      set({
        roomId: numericRoomId,
        myPlayer,
        pendingPlayerChoice,
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

      // Load this player's pre-moves (no-op if not in any seat)
      if (myPlayer) {
        try {
          const { trees, notice } = await premovesApi.getPremoves(numericRoomId);
          set({ premoves: myPlayer === 1 ? trees.player1 : trees.player2, premoveNotice: notice });
        } catch { /* ignore */ }
      }

      return true;
    } catch (err) {
      set({ error: 'Failed to join room', isLoading: false });
      return false;
    }
  },

  pollRoom: async () => {
    const { roomId } = get();
    if (!roomId || get().pendingMoveCount > 0) return;

    try {
      // Fast path: check only updatedAt before pulling the full blob.
      const head = await roomsApi.getRoomHead(roomId);
      if (!head) return;
      if (get().pendingMoveCount > 0) return;

      const { lastUpdated, myPlayer: myP } = get();
      if (head.updatedAt <= lastUpdated) return; // nothing changed

      const room = await roomsApi.getRoom(roomId);
      if (!room || get().pendingMoveCount > 0) return;

      // Re-check after the full fetch: a concurrent handlePlacement could have
      // updated lastUpdated in the store between the HEAD call and now.
      if (room.updatedAt > lastUpdated) {
        const prevWinner = get().state.winner;
        const syncedState = normalizePhaseForCaptures(syncWinnerFromRoom(room.state, room.winner));
        if (syncedState.winner && !prevWinner && get().rated) {
          useAuthStore.getState().fetchMe();
        }
        // Refresh pre-moves: the tree might have just shifted down (a branch
        // auto-fired) or been pruned, and we need to mirror that.
        if (myP) {
          premovesApi.getPremoves(roomId).then(({ trees, notice }) => {
            set({ premoves: myP === 1 ? trees.player1 : trees.player2, premoveNotice: notice });
          }).catch(() => { /* ignore */ });
        }

        // If the user is currently analyzing, merge new live moves into the
        // analysis tree without moving their analysisCurrentNode pointer.
        const { isAnalyzing, analysisGameTree } = get();
        let mergedAnalysisTree: GameNode | null = null;
        if (isAnalyzing && analysisGameTree) {
          const added = mergeLiveTreeIntoAnalysis(analysisGameTree, room.tree);
          if (added > 0) {
            // Swap the root reference so subscribers re-render. Mutations are
            // already applied to the shared subtree.
            mergedAnalysisTree = { ...analysisGameTree };
          }
        }

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
          availableCaptureChains: [],
          rated: room.rated,
          user1Rating: room.user1Rating,
          user2Rating: room.user2Rating,
          ratingDelta: room.ratingDelta || get().ratingDelta,
          timeControlBaseMs: room.timeControlBaseMs,
          timeControlIncrementMs: room.timeControlIncrementMs,
          clockP1Ms: room.clockP1Ms,
          clockP2Ms: room.clockP2Ms,
          clockRunningSince: room.clockRunningSince,
          ...(mergedAnalysisTree ? { analysisGameTree: mergedAnalysisTree, lastLiveMergeAt: Date.now() } : {}),
        });
        await persistOnlineGame(roomId, syncedState, room.tree, room.playerNames, room.winType);
        if (mergedAnalysisTree) persistAnalysisLocal(get());
      }
    } catch {
      // Ignore polling errors
    }
  },

  pollMessages: async () => {
    const { roomId, lastMessageId, state } = get();
    if (!roomId || state.winner) return;

    try {
      const newMessages = await roomsApi.getChatMessages(roomId, lastMessageId);
      if (newMessages.length > 0) {
        set(s => {
          const existingIds = new Set(s.messages.map(m => m.id));
          const unique = newMessages.filter(m => !existingIds.has(m.id));
          if (unique.length === 0) return s;
          return {
            messages: [...s.messages, ...unique],
            lastMessageId: newMessages[newMessages.length - 1].id,
          };
        });
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
      // Add message optimistically but do NOT update lastMessageId.
      // This prevents skipping messages from the opponent that may have IDs
      // between the previous lastMessageId and the just-sent message's ID.
      // pollMessages will discover the sent message and advance lastMessageId correctly.
      set(s => {
        if (s.messages.some(m => m.id === message.id)) return s;
        return { messages: [...s.messages, message] };
      });
    } catch {
      // Ignore send errors
    }
  },

  selectMarbleColor: (color) => {
    const { myPlayer, state } = get();
    if (!myPlayer) return;
    const myPlayerStr = myPlayer === 1 ? 'player1' : 'player2';
    if (state.currentPlayer !== myPlayerStr) return; // Not my turn
    set({ selectedMarbleColor: color, selectedRingId: null, highlightedCaptures: [], availableCaptureChains: [] });
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
          highlightedCaptures: chains.map(c => c[c.length - 1]),
          availableCaptureChains: chains,
        });
      } else {
        // Marble has no captures from here — clear stale highlights.
        set({ selectedRingId: null, highlightedCaptures: [], availableCaptureChains: [] });
      }
    } else if (state.phase === 'capture' && !ring.marble) {
      // Empty ring clicked during capture phase — clear selection.
      set({ selectedRingId: null, highlightedCaptures: [], availableCaptureChains: [] });
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

    set(s => ({ pendingMoveCount: s.pendingMoveCount + 1 }));
    try {
      const result = applyPlacement(state, ringId, selectedMarbleColor);
      if (!result) return;

      const { newState, move, winner, winType, needsRingRemoval } = result;
      normalizePhase(newState);

      playPlaceSound();
      if (winner) playWinSound();

      const newNode = addMoveToTree(currentNode, move, state.currentPlayer, state.moveNumber, state.boardSize);
      set({ state: newState, currentNode: newNode, selectedMarbleColor: null, selectedRingId: null, highlightedCaptures: [], availableCaptureChains: [], winType: winType ?? null });

      if (!needsRingRemoval) {
        const winnerNum = winner === 'player1' ? 1 : winner === 'player2' ? 2 : null;
        const currentPlayerNum = newState.currentPlayer === 'player1' ? 1 : 2;
        const res = await roomsApi.updateRoomState(roomId, newState, gameTree, currentPlayerNum as 1 | 2, winnerNum, winType, myPlayer || undefined);
        if (res.ratingDelta) set({ ratingDelta: res.ratingDelta });
        if (winner && get().rated) useAuthStore.getState().fetchMe();
        await persistOnlineGame(roomId, newState, gameTree, playerNames, winType);
      } else {
        const currentPlayerNum = state.currentPlayer === 'player1' ? 1 : 2;
        await roomsApi.updateRoomState(roomId, newState, gameTree, currentPlayerNum as 1 | 2, null, null, myPlayer || undefined);
        await persistOnlineGame(roomId, newState, gameTree, playerNames, null);
      }
    } catch (err) {
      console.error('[roomStore.handlePlacement] ERROR:', err);
    } finally {
      set(s => ({ pendingMoveCount: s.pendingMoveCount - 1 }));
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

    set(s => ({ pendingMoveCount: s.pendingMoveCount + 1 }));
    try {
      const result = applyRingRemoval(state, currentNode, ringId);
      if (!result) return;

      const { newState, winner, winType } = result;
      normalizePhase(newState);

      playRemoveRingSound();
      if (winner) playWinSound();

      set({ state: newState, selectedRingId: null, highlightedCaptures: [], availableCaptureChains: [], winType: winType ?? null });

      const winnerNum = winner === 'player1' ? 1 : winner === 'player2' ? 2 : null;
      const currentPlayerNum = newState.currentPlayer === 'player1' ? 1 : 2;
      const res = await roomsApi.updateRoomState(roomId, newState, gameTree, currentPlayerNum as 1 | 2, winnerNum, winType, myPlayer || undefined);
      if (res.ratingDelta) set({ ratingDelta: res.ratingDelta });
      if (winner && get().rated) useAuthStore.getState().fetchMe();
      await persistOnlineGame(roomId, newState, gameTree, playerNames, winType);
    } catch (err) {
      console.error('[roomStore.handleRingRemoval] ERROR:', err);
    } finally {
      set(s => ({ pendingMoveCount: s.pendingMoveCount - 1 }));
    }
  },

  handleCapture: async (captures) => {
    const { state, roomId, currentNode, gameTree, playerNames, myPlayer } = get();
    if (!roomId || !myPlayer) return;
    // Turn enforcement
    const myPlayerStrC = myPlayer === 1 ? 'player1' : 'player2';
    if (state.currentPlayer !== myPlayerStrC) return;

    set(s => ({ pendingMoveCount: s.pendingMoveCount + 1 }));
    try {
      const { newState, move, previousPlayer, previousMoveNumber, winner, winType } = applyCapture(state, captures);
      normalizePhase(newState);

      const newNode = addMoveToTree(currentNode, move, previousPlayer, previousMoveNumber, state.boardSize);

      playCaptureSound();
      if (winner) playWinSound();

      set({ state: newState, currentNode: newNode, selectedRingId: null, highlightedCaptures: [], availableCaptureChains: [], winType: winType ?? null });

      const winnerNum = winner === 'player1' ? 1 : winner === 'player2' ? 2 : null;
      const currentPlayerNum = newState.currentPlayer === 'player1' ? 1 : 2;
      const res = await roomsApi.updateRoomState(roomId, newState, gameTree, currentPlayerNum as 1 | 2, winnerNum, winType, myPlayer || undefined);
      if (res.ratingDelta) set({ ratingDelta: res.ratingDelta });
      if (winner && get().rated) useAuthStore.getState().fetchMe();
      await persistOnlineGame(roomId, newState, gameTree, playerNames, winType);
    } catch (err) {
      console.error('[roomStore.handleCapture] ERROR:', err);
    } finally {
      set(s => ({ pendingMoveCount: s.pendingMoveCount - 1 }));
    }
  },

  undoLastMove: async (overrideCheck = false) => {
    const { roomId, currentNode, state, gameTree, playerNames, myPlayer } = get();
    if (!roomId || !myPlayer || !currentNode.parent) return;
    const myPlayerStr = myPlayer === 1 ? 'player1' : 'player2';
    if (!overrideCheck && currentNode.player !== myPlayerStr) return;

    set(s => ({ pendingMoveCount: s.pendingMoveCount + 1 }));
    try {
      // Walk back to find the first node belonging to myPlayer in their current consecutive turn.
      // A turn may span multiple tree nodes (e.g. placement node + one or more capture nodes).
      let startOfTurn = currentNode;
      while (
        startOfTurn.parent &&
        startOfTurn.parent.move !== null &&
        startOfTurn.parent.player === myPlayerStr
      ) {
        startOfTurn = startOfTurn.parent;
      }

      const parentNode = startOfTurn.parent!;
      const idx = parentNode.children.indexOf(startOfTurn);
      if (idx >= 0) {
        parentNode.children.splice(idx, 1);
        syncMainLineFlags(parentNode);
      }

      const newState = rebuildStateFromNode(parentNode, state.boardSize);
      const winner = newState.winner;
      const winType = winner && winner !== 'cancelled' ? getWinType(newState, winner) : null;

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
      // isUndo=true tells the backend to skip clock deduction — clocks must not change on undo
      await roomsApi.updateRoomState(roomId, newState, gameTree, currentPlayerNum as 1 | 2, winnerNum, winType, myPlayer, true);
      await persistOnlineGame(roomId, newState, gameTree, playerNames, winType);
    } catch (err) {
      console.error('[roomStore.undoLastMove] ERROR:', err);
    } finally {
      set(s => ({ pendingMoveCount: s.pendingMoveCount - 1 }));
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

    set(s => ({ pendingMoveCount: s.pendingMoveCount + 1 }));
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
      set(s => ({ pendingMoveCount: s.pendingMoveCount - 1 }));
    }
  },

  cancelGame: async () => {
    const { roomId, state, gameTree, playerNames } = get();
    if (!roomId || state.winner || (state.moveNumber ?? 0) > 2) return;

    set(s => ({ pendingMoveCount: s.pendingMoveCount + 1 }));
    try {
      await roomsApi.cancelGame(roomId);
      const newState = cloneState(state);
      newState.winner = 'cancelled';
      const winType = 'cancelled';
      set({ state: newState, winType });
      await persistOnlineGame(roomId, newState, gameTree, playerNames, winType);
    } catch (err) {
      console.error('[roomStore.cancelGame] ERROR:', err);
    } finally {
      set(s => ({ pendingMoveCount: s.pendingMoveCount - 1 }));
    }
  },

  addTime: async () => {
    const { roomId, myPlayer, state, timeControlBaseMs } = get();
    // Only meaningful in an ongoing timed game where I'm a seated player.
    if (!roomId || !myPlayer || state.winner || timeControlBaseMs == null) return;

    try {
      const result = await roomsApi.addTime(roomId);
      // Server returns the authoritative post-add clock values; mirror them
      // optimistically so the opponent's clock jumps without waiting for poll.
      set({
        clockP1Ms: result.clockP1Ms,
        clockP2Ms: result.clockP2Ms,
      });
    } catch (err) {
      console.error('[roomStore.addTime] ERROR:', err);
    }
  },

  claimSeat: async () => {
    const { roomId, pendingPlayerChoice, playerNames } = get();
    const authUser = useAuthStore.getState().user;
    if (!roomId || !pendingPlayerChoice || !authUser) return;

    const names = { ...playerNames };
    if (pendingPlayerChoice === 1) names.player1 = authUser.username;
    else names.player2 = authUser.username;

    await roomsApi.updatePlayerName(roomId, pendingPlayerChoice, authUser.username);
    try {
      await fetch(`${API_BASE}/api/rooms/${roomId}/join`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ playerIndex: pendingPlayerChoice }),
      });
    } catch { /* ignore */ }

    set({
      myPlayer: pendingPlayerChoice,
      pendingPlayerChoice: null,
      playerNames: names,
      user1Id: pendingPlayerChoice === 1 ? authUser.id : get().user1Id,
      user2Id: pendingPlayerChoice === 2 ? authUser.id : get().user2Id,
    });
  },

  declineSeat: () => {
    set({ pendingPlayerChoice: null });
  },

  // ==================== Analysis mode ====================

  enterAnalysis: () => {
    const { state, gameTree, currentNode, isAnalyzing, premoves, roomId } = get();
    if (isAnalyzing) return;

    const authUserId = useAuthStore.getState().user?.id;
    const saved = (authUserId && roomId) ? loadAnalysis(authUserId, roomId) : null;

    let analysisTree: GameNode;
    let startNode: GameNode;
    let analysisCurrent: GameNode;
    let analysisStateValue: GameState;

    if (saved) {
      // Resume from previously saved session.
      analysisTree = saved.tree;
      // Sync any live moves that landed since last save.
      mergeLiveTreeIntoAnalysis(analysisTree, gameTree);

      const startFound = findNodeAndParent(analysisTree, saved.startNodeId);
      startNode = startFound?.node ?? analysisTree;

      const currentFound = findNodeAndParent(analysisTree, saved.currentNodeId);
      analysisCurrent = currentFound?.node ?? startNode;

      // Pre-moves dedup by move equality, so re-injecting won't duplicate.
      injectPremovesIntoTree(startNode, premoves);

      // Replay state at the user's last-viewed position.
      analysisStateValue = rebuildStateFromNode(analysisCurrent, state.boardSize);
      normalizePhase(analysisStateValue);
    } else {
      // Fresh start — clone the live tree at the current position.
      analysisTree = deserializeTree(serializeTree(gameTree));
      const found = findNodeAndParent(analysisTree, currentNode.id);
      startNode = found ? found.node : analysisTree;
      analysisCurrent = startNode;
      injectPremovesIntoTree(startNode, premoves);
      analysisStateValue = cloneState(state);
    }

    set({
      isAnalyzing: true,
      analysisState: analysisStateValue,
      analysisGameTree: analysisTree,
      analysisCurrentNode: analysisCurrent,
      analysisStartNodeId: startNode.id,
      selectedMarbleColor: null,
      selectedRingId: null,
      highlightedCaptures: [],
      availableCaptureChains: [],
    });

    persistAnalysisLocal(get());
  },

  exitAnalysis: () => {
    set({
      isAnalyzing: false,
      analysisState: null,
      analysisGameTree: null,
      analysisCurrentNode: null,
      analysisStartNodeId: null,
      selectedMarbleColor: null,
      selectedRingId: null,
      highlightedCaptures: [],
      availableCaptureChains: [],
    });
  },

  analysisSelectMarbleColor: (color) => {
    set({ selectedMarbleColor: color, selectedRingId: null, highlightedCaptures: [], availableCaptureChains: [] });
  },

  analysisSelectRing: (ringId) => {
    const { analysisState } = get();
    if (!analysisState) return;
    const slice = computeAnalysisRingSelection(analysisState, ringId);
    if (slice) set(slice);
  },

  analysisHandlePlacement: (ringId) => {
    const { analysisState, analysisCurrentNode, analysisGameTree, selectedMarbleColor } = get();
    if (!analysisState || !analysisCurrentNode || !analysisGameTree || !selectedMarbleColor) return;

    const result = applyAnalysisPlacement(analysisState, analysisCurrentNode, ringId, selectedMarbleColor);
    if (!result) return;

    set({
      analysisState: result.analysisState,
      analysisCurrentNode: result.analysisCurrentNode,
      analysisGameTree: { ...analysisGameTree },
      selectedMarbleColor: null,
      selectedRingId: null,
      highlightedCaptures: [],
      availableCaptureChains: [],
    });
    persistAnalysisLocal(get());
  },

  analysisHandleRingRemoval: (ringId) => {
    const { analysisState, analysisCurrentNode, analysisGameTree } = get();
    if (!analysisState || !analysisCurrentNode || !analysisGameTree) return;

    const result = applyAnalysisRingRemoval(analysisState, analysisCurrentNode, ringId);
    if (!result) return;

    set({
      analysisState: result.analysisState,
      analysisGameTree: { ...analysisGameTree },
      selectedRingId: null,
      highlightedCaptures: [],
      availableCaptureChains: [],
    });
    persistAnalysisLocal(get());
  },

  analysisHandleCapture: (captures) => {
    const { analysisState, analysisCurrentNode, analysisGameTree } = get();
    if (!analysisState || !analysisCurrentNode || !analysisGameTree) return;

    const result = applyAnalysisCapture(analysisState, analysisCurrentNode, captures);
    set({
      analysisState: result.analysisState,
      analysisCurrentNode: result.analysisCurrentNode,
      analysisGameTree: { ...analysisGameTree },
      selectedRingId: null,
      highlightedCaptures: [],
      availableCaptureChains: [],
    });
    persistAnalysisLocal(get());
  },

  analysisNavigateToNode: (targetNode) => {
    const { analysisState } = get();
    if (!analysisState) return;
    const newState = rebuildStateFromNode(targetNode, analysisState.boardSize);
    set({
      analysisState: newState,
      analysisCurrentNode: targetNode,
      selectedMarbleColor: null,
      selectedRingId: null,
      highlightedCaptures: [],
      availableCaptureChains: [],
    });
    persistAnalysisLocal(get());
  },

  // ==================== Pre-moves ====================

  loadPremoves: async () => {
    const { roomId, myPlayer } = get();
    if (!roomId || !myPlayer) return;
    try {
      const { trees, notice } = await premovesApi.getPremoves(roomId);
      set({ premoves: myPlayer === 1 ? trees.player1 : trees.player2, premoveNotice: notice });
    } catch {
      // ignore
    }
  },

  // Merges the current analysis path into the pre-move tree. Returns a result
  // the UI acts on: `conflict` (a differing reply is already planned — re-call
  // with overwrite=true to confirm) or `ownMoveFirst` (the path starts with my
  // own move — Phase 3 plays it immediately, not stored here).
  savePremovePath: async (overwrite = false): Promise<SavePremoveResult> => {
    const { roomId, myPlayer, analysisGameTree, analysisCurrentNode, analysisStartNodeId, premoves, state } = get();
    if (!roomId || !myPlayer || !analysisGameTree || !analysisCurrentNode || !analysisStartNodeId) {
      return { ok: false, reason: 'empty' };
    }

    const steps = pathFromAnchor(analysisCurrentNode, analysisStartNodeId, state.boardSize);
    if (steps.length === 0) return { ok: false, reason: 'empty' };

    const ownerStr: Player = myPlayer === 1 ? 'player1' : 'player2';
    // Arm-from-own: the first planned move is mine → it must be played as a real
    // move now (handled by the caller), not stored as a conditional pre-move.
    if (steps[0].player === ownerStr) {
      return { ok: false, reason: 'ownMoveFirst', firstMoveNotation: steps[0].notation };
    }

    const anchorStateJson = serializeState(state);
    const merged = mergePathIntoTree(premoves, steps, anchorStateJson, ownerStr, overwrite);
    if (!merged.ok) {
      return {
        ok: false,
        reason: 'conflict',
        existingNotation: merged.conflict.existingNotation,
        newNotation: merged.conflict.newNotation,
      };
    }

    const prev = premoves;
    set({ premoves: merged.tree });
    try {
      await premovesApi.setPremoves(roomId, merged.tree);
      return { ok: true };
    } catch {
      set({ premoves: prev }); // revert on error
      return { ok: false, reason: 'error' };
    }
  },

  // Arm-from-own: the analysis path starts with MY move. Play that move for
  // real on the live board now, then store the remainder (which starts with the
  // opponent's reply) as my pre-move tree. Reuses the interactive live handlers
  // so tree/clock/persist logic isn't duplicated.
  armFromOwnMove: async (overwrite = false): Promise<SavePremoveResult> => {
    const { roomId, myPlayer, analysisCurrentNode, analysisStartNodeId, state } = get();
    if (!roomId || !myPlayer || !analysisCurrentNode || !analysisStartNodeId) {
      return { ok: false, reason: 'empty' };
    }
    const steps = pathFromAnchor(analysisCurrentNode, analysisStartNodeId, state.boardSize);
    if (steps.length === 0) return { ok: false, reason: 'empty' };

    const ownerStr: Player = myPlayer === 1 ? 'player1' : 'player2';
    // Not actually own-first → fall back to the normal (store-only) save.
    if (steps[0].player !== ownerStr) return get().savePremovePath(overwrite);
    // Must be my live turn to play the first move.
    if (state.currentPlayer !== ownerStr || state.winner) return { ok: false, reason: 'error' };

    // Build the remainder tree (opponent reply onward), anchored at the position
    // after my move. A single linear path never self-conflicts, so this is safe.
    const remainder = steps.slice(1);
    let remainderTree: PreMoveTree | null = null;
    if (remainder.length > 0) {
      const merged = mergePathIntoTree(null, remainder, steps[0].newStateJson, ownerStr, true);
      if (merged.ok) remainderTree = merged.tree;
    }

    // Play my first move for real, reusing the interactive handlers.
    const first: Move = steps[0].move;
    if (first.type === 'placement') {
      set({ selectedMarbleColor: first.data.marbleColor });
      await get().handlePlacement(first.data.ringId);
      if (first.data.removedRingId) await get().handleRingRemoval(first.data.removedRingId);
    } else if (first.type === 'capture') {
      const { chain, ...firstCapture } = first.data;
      await get().handleCapture([firstCapture as CaptureMove, ...((chain as CaptureMove[]) || [])]);
    } else {
      return { ok: false, reason: 'error' };
    }

    // The move succeeded iff the turn passed (or the game ended).
    const after = get().state;
    if (after.currentPlayer === ownerStr && !after.winner) {
      return { ok: false, reason: 'error' };
    }

    // Store the remainder as my new pre-move tree (replaces the now-stale one).
    set({ premoves: remainderTree });
    try {
      await premovesApi.setPremoves(roomId, remainderTree);
      return { ok: true };
    } catch {
      return { ok: false, reason: 'error' };
    }
  },

  deletePremoveBranch: async (nodeId) => {
    const { roomId, premoves } = get();
    if (!roomId || !premoves) return;
    const updated = removeBranch(premoves, nodeId);
    if (updated === premoves) return;
    const prev = premoves;
    set({ premoves: updated });
    try {
      await premovesApi.setPremoves(roomId, updated);
    } catch {
      set({ premoves: prev });
    }
  },

  clearPremoves: async () => {
    const { roomId, premoves } = get();
    if (!roomId || !premoves) return;
    const prev = premoves;
    set({ premoves: null });
    try {
      await premovesApi.setPremoves(roomId, null);
    } catch {
      set({ premoves: prev });
    }
  },

  reset: () => {
    const rootNode = createRootNode();
    set({
      pendingMoveCount: 0,
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
      pendingPlayerChoice: null,
      isAnalyzing: false,
      analysisState: null,
      analysisGameTree: null,
      analysisCurrentNode: null,
      analysisStartNodeId: null,
      lastLiveMergeAt: 0,
      premoves: null,
      premoveNotice: null,
    });
  },
}));
