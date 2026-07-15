import { create } from 'zustand';
import { getPushPref, subscribeToPush, unsubscribeFromPush, initPushIfFirstVisit } from '../pushNotifications';

type Screen = 'menu' | 'game' | 'history' | 'rules' | 'settings';
export type Language = 'ru' | 'en' | 'eo';

const LANGUAGE_KEY = 'zertz_language';
const COORDS_KEY = 'zertz_show_coords';

function getInitialLanguage(): Language {
  const saved = localStorage.getItem(LANGUAGE_KEY);
  if (saved === 'en' || saved === 'eo' || saved === 'ru') return saved;
  return 'en';
}

function getInitialShowCoordinates(): boolean {
  // Default on — coordinates help reading move notation. Persisted per browser.
  return localStorage.getItem(COORDS_KEY) !== '0';
}

interface UIStore {
  screen: Screen;
  previousScreen: Screen;
  isDarkMode: boolean;
  showMoveHistory: boolean;
  showCoordinates: boolean;
  language: Language;
  pushEnabled: boolean;
  pushPending: boolean;

  setScreen: (screen: Screen) => void;
  initPush: () => void;
  openRules: () => void;
  toggleDarkMode: () => void;
  toggleMoveHistory: () => void;
  toggleCoordinates: () => void;
  setLanguage: (language: Language) => void;
  cycleLanguage: () => void;
  togglePush: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  screen: 'menu',
  previousScreen: 'menu',
  isDarkMode: false,
  showMoveHistory: false,
  showCoordinates: getInitialShowCoordinates(),
  language: getInitialLanguage(),
  pushEnabled: getPushPref(),
  pushPending: false,
  
  setScreen: (screen: Screen) => set({ screen }),

  openRules: () => set((state) => ({ previousScreen: state.screen, screen: 'rules' })),
  
  toggleDarkMode: () => set((state) => {
    const newMode = !state.isDarkMode;
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return { isDarkMode: newMode };
  }),
  
  toggleMoveHistory: () => set((state) => ({ showMoveHistory: !state.showMoveHistory })),

  toggleCoordinates: () => set((state) => {
    const next = !state.showCoordinates;
    localStorage.setItem(COORDS_KEY, next ? '1' : '0');
    return { showCoordinates: next };
  }),

  setLanguage: (language) => {
    localStorage.setItem(LANGUAGE_KEY, language);
    set({ language });
  },

  cycleLanguage: () => set((state) => {
    const order: Language[] = ['ru', 'en', 'eo'];
    const idx = order.indexOf(state.language);
    const next = order[(idx + 1) % order.length];
    localStorage.setItem(LANGUAGE_KEY, next);
    return { language: next };
  }),

  initPush: () => {
    initPushIfFirstVisit().then((ok) => {
      if (ok) set({ pushEnabled: true });
    });
  },

  togglePush: () => set((state) => {
    if (state.pushPending) return {};
    if (state.pushEnabled) {
      unsubscribeFromPush();
      return { pushEnabled: false };
    } else {
      set({ pushPending: true });
      subscribeToPush().then((ok) => {
        set({ pushEnabled: ok, pushPending: false });
      });
      return {};
    }
  }),
}));
