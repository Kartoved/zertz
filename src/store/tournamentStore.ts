import { create } from 'zustand';
import {
  TournamentSummary, TournamentDetail,
  getTournaments, getTournament, createTournament,
  joinTournament, pauseTournament, resumeTournament,
} from '../db/tournamentApi';
import { serializeState, serializeTree } from '../db/apiClient';
import { createInitialState } from '../game/GameEngine';
import { createRootNode } from '../utils/gameTreeUtils';

interface TournamentStore {
  list: TournamentSummary[];
  detail: TournamentDetail | null;
  isLoading: boolean;
  error: string | null;

  fetchList: () => Promise<void>;
  fetchDetail: (id: number) => Promise<void>;
  create: (params: {
    name: string;
    startsAt: number;
    durationMin: number;
    boardSize: 37 | 48 | 61;
    berserk: boolean;
  }) => Promise<number>;
  join: (id: number) => Promise<void>;
  pause: (id: number) => Promise<void>;
  resume: (id: number) => Promise<void>;

  startListPolling: () => void;
  stopListPolling: () => void;
  startDetailPolling: (id: number) => void;
  stopDetailPolling: () => void;
}

let _listInterval: ReturnType<typeof setInterval> | null = null;
let _detailInterval: ReturnType<typeof setInterval> | null = null;

export const useTournamentStore = create<TournamentStore>((set, get) => ({
  list: [],
  detail: null,
  isLoading: false,
  error: null,

  fetchList: async () => {
    try {
      const list = await getTournaments();
      set({ list, error: null });
    } catch {
      // silent — keep stale data on poll failure
    }
  },

  fetchDetail: async (id) => {
    try {
      const detail = await getTournament(id);
      set({ detail, error: null });
    } catch {
      // silent — keep stale data on poll failure
    }
  },

  create: async ({ name, startsAt, durationMin, boardSize, berserk }) => {
    set({ isLoading: true, error: null });
    try {
      const state = createInitialState(boardSize);
      const root = createRootNode();
      const { id } = await createTournament({
        name, startsAt, durationMin, boardSize, berserk,
        stateJson: serializeState(state),
        treeJson: serializeTree(root),
      });
      await get().fetchList();
      return id;
    } catch (err: any) {
      set({ error: err.message || 'Ошибка создания' });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  join: async (id) => {
    try {
      await joinTournament(id);
      await get().fetchDetail(id);
    } catch (err: any) {
      set({ error: err.message || 'Ошибка' });
      throw err;
    }
  },

  pause: async (id) => {
    await pauseTournament(id);
    await get().fetchDetail(id);
  },

  resume: async (id) => {
    await resumeTournament(id);
    await get().fetchDetail(id);
  },

  startListPolling: () => {
    if (_listInterval) return;
    get().fetchList();
    _listInterval = setInterval(() => get().fetchList(), 5000);
  },
  stopListPolling: () => {
    if (_listInterval) { clearInterval(_listInterval); _listInterval = null; }
  },

  startDetailPolling: (id) => {
    if (_detailInterval) clearInterval(_detailInterval);
    get().fetchDetail(id);
    _detailInterval = setInterval(() => get().fetchDetail(id), 3000);
  },
  stopDetailPolling: () => {
    if (_detailInterval) { clearInterval(_detailInterval); _detailInterval = null; }
    set({ detail: null });
  },
}));
