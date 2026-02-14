import { create } from 'zustand';
import * as authApi from '../db/authApi';
import type { User } from '../db/authApi';

const TOKEN_KEY = 'zertz_auth_token';

interface AuthStore {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  updateProfile: (updates: { quote?: string; country?: string; oldPassword?: string; newPassword?: string }) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  token: localStorage.getItem(TOKEN_KEY),
  isLoading: false,
  error: null,

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const { token, user } = await authApi.login(username, password);
      localStorage.setItem(TOKEN_KEY, token);
      set({ token, user, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  register: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const { token, user } = await authApi.register(username, password);
      localStorage.setItem(TOKEN_KEY, token);
      set({ token, user, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null, user: null, error: null });
  },

  fetchMe: async () => {
    const { token } = get();
    if (!token) return;

    set({ isLoading: true });
    try {
      const user = await authApi.getMe(token);
      set({ user, isLoading: false });
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      set({ token: null, user: null, isLoading: false });
    }
  },

  updateProfile: async (updates) => {
    const { token } = get();
    if (!token) return;

    set({ isLoading: true, error: null });
    try {
      const user = await authApi.updateProfile(token, updates);
      set({ user, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));

// Auto-fetch user on app start if token exists
const token = localStorage.getItem(TOKEN_KEY);
if (token) {
  useAuthStore.getState().fetchMe();
}
