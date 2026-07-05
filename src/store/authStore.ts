import { create } from 'zustand';
import * as authApi from '../db/authApi';
import { AuthError } from '../db/authApi';
import type { User } from '../db/authApi';

const TOKEN_KEY = 'zertz_auth_token';

interface AuthStore {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  incomingChallengesCount: number;

  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, email?: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  updateProfile: (updates: { quote?: string; country?: string; contactLink?: string; email?: string; oldPassword?: string; newPassword?: string }) => Promise<void>;
  clearError: () => void;
  pollChallenges: () => Promise<void>;
  loginWithToken: (token: string, user: authApi.User) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  token: localStorage.getItem(TOKEN_KEY),
  isLoading: false,
  error: null,
  incomingChallengesCount: 0,

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

  register: async (username, password, email) => {
    set({ isLoading: true, error: null });
    try {
      const { token, user } = await authApi.register(username, password, email);
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
    } catch (err) {
      set({ isLoading: false });
      // Only log out on 401 (token invalid/expired). Transient errors like
      // 429 (rate limit), 503 (server restart) or network failures should
      // never end the session — the token is still valid.
      if (err instanceof AuthError && err.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        set({ token: null, user: null });
      }
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

  loginWithToken: (token: string, user: authApi.User) => {
    localStorage.setItem(TOKEN_KEY, token);
    set({ token, user });
  },

  pollChallenges: async () => {
    const { token, user } = get();
    if (!token || !user) return;
    try {
      const challenges = await authApi.getChallenges();
      const incoming = challenges.filter((c: authApi.Challenge) => c.toUserId === user.id);
      set({ incomingChallengesCount: incoming.length });
    } catch {
      // ignore
    }
  },
}));

// Auto-fetch user on app start if token exists
const token = localStorage.getItem(TOKEN_KEY);
if (token) {
  useAuthStore.getState().fetchMe().then(() => {
    useAuthStore.getState().pollChallenges();
  });
}

// Poll for incoming challenges every 15 seconds when logged in
let challengePollInterval: ReturnType<typeof setInterval> | null = null;
// Send a heartbeat every 60 seconds to keep last_seen fresh for presence detection.
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

function sendHeartbeatNow() {
  const tk = useAuthStore.getState().token;
  if (tk) authApi.sendHeartbeat(tk);
}

useAuthStore.subscribe((state, prev) => {
  if (state.user && !prev.user) {
    challengePollInterval = setInterval(() => {
      useAuthStore.getState().pollChallenges();
    }, 15000);
    sendHeartbeatNow();
    heartbeatInterval = setInterval(sendHeartbeatNow, 60000);
  } else if (!state.user && prev.user) {
    if (challengePollInterval !== null) {
      clearInterval(challengePollInterval);
      challengePollInterval = null;
    }
    if (heartbeatInterval !== null) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  }
});

// Fire an immediate heartbeat if we already have a token at app start.
if (token) {
  sendHeartbeatNow();
  heartbeatInterval = setInterval(sendHeartbeatNow, 60000);
}
