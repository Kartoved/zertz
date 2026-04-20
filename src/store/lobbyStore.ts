import { create } from 'zustand';
import { LobbySlot, getLobbySlots, createLobbySlot, deleteMyLobbySlot, joinLobbySlot } from '../db/lobbyApi';
import { serializeState, serializeTree } from '../db/apiClient';
import { createInitialState } from '../game/GameEngine';
import { createRootNode } from '../utils/gameTreeUtils';

interface LobbyStore {
  slots: LobbySlot[];
  isLoading: boolean;
  error: string | null;

  fetchSlots: () => Promise<void>;
  createSlot: (params: {
    boardSize: 37 | 48 | 61;
    timeControlId: string;
    timeControlBaseMs: number | null;
    timeControlIncrementMs: number | null;
    rated: boolean;
  }) => Promise<void>;
  removeMySlot: () => Promise<void>;
  joinSlot: (slotId: number) => Promise<number>;
  startPolling: () => void;
  stopPolling: () => void;
}

let _pollInterval: ReturnType<typeof setInterval> | null = null;

export const useLobbyStore = create<LobbyStore>((set, get) => ({
  slots: [],
  isLoading: false,
  error: null,

  fetchSlots: async () => {
    try {
      const slots = await getLobbySlots();
      set({ slots, error: null });
    } catch {
      // silent — keep stale data on poll failure
    }
  },

  createSlot: async ({ boardSize, timeControlId, timeControlBaseMs, timeControlIncrementMs, rated }) => {
    set({ isLoading: true, error: null });
    try {
      const state = createInitialState(boardSize);
      const root = createRootNode();
      const stateJson = serializeState(state);
      const treeJson = serializeTree(root);
      await createLobbySlot({ boardSize, timeControlId, timeControlBaseMs, timeControlIncrementMs, rated, stateJson, treeJson });
      await get().fetchSlots();
    } catch (err: any) {
      set({ error: err.message || 'Ошибка создания' });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  removeMySlot: async () => {
    set({ isLoading: true, error: null });
    try {
      await deleteMyLobbySlot();
      await get().fetchSlots();
    } catch (err: any) {
      set({ error: err.message || 'Ошибка удаления' });
    } finally {
      set({ isLoading: false });
    }
  },

  joinSlot: async (slotId: number) => {
    set({ isLoading: true, error: null });
    try {
      const { roomId } = await joinLobbySlot(slotId);
      await get().fetchSlots();
      return roomId;
    } catch (err: any) {
      set({ error: err.message || 'Ошибка присоединения' });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  startPolling: () => {
    if (_pollInterval) return;
    get().fetchSlots();
    _pollInterval = setInterval(() => get().fetchSlots(), 5000);
  },

  stopPolling: () => {
    if (_pollInterval) {
      clearInterval(_pollInterval);
      _pollInterval = null;
    }
  },
}));
