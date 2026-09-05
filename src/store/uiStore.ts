import { create } from 'zustand';
import { getPushPref, subscribeToPush, unsubscribeFromPush, initPushIfFirstVisit } from '../pushNotifications';
import { detectLanguage } from '../utils/detectLanguage';

type Screen = 'menu' | 'game' | 'history' | 'rules' | 'settings';
export type Language = 'ru' | 'en' | 'eo';

const LANGUAGE_KEY = 'zertz_language';
const COORDS_KEY = 'zertz_show_coords';

// Test/SSR-safe localStorage access (undefined outside the browser).
const ls: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null;

function getInitialLanguage(): Language {
  const saved = ls?.getItem(LANGUAGE_KEY);
  if (saved === 'en' || saved === 'eo' || saved === 'ru') return saved;
  // Nothing stored yet → guess from the browser (ru for Russia/CIS, en
  // otherwise). Not persisted: only an explicit switch writes LANGUAGE_KEY, so
  // a guessed language keeps re-detecting until the user actually picks one.
  return detectLanguage();
}

// Keeps <html lang> honest for screen readers and hyphenation.
function applyHtmlLang(language: Language) {
  if (typeof document !== 'undefined') document.documentElement.lang = language;
}

function getInitialShowCoordinates(): boolean {
  // Default on — coordinates help reading move notation. Persisted per browser.
  return ls?.getItem(COORDS_KEY) !== '0';
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

const initialLanguage = getInitialLanguage();
applyHtmlLang(initialLanguage);

export const useUIStore = create<UIStore>((set) => ({
  screen: 'menu',
  previousScreen: 'menu',
  isDarkMode: false,
  showMoveHistory: false,
  showCoordinates: getInitialShowCoordinates(),
  language: initialLanguage,
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
    ls?.setItem(COORDS_KEY, next ? '1' : '0');
    return { showCoordinates: next };
  }),

  setLanguage: (language) => {
    ls?.setItem(LANGUAGE_KEY, language);
    applyHtmlLang(language);
    set({ language });
  },

  cycleLanguage: () => set((state) => {
    const order: Language[] = ['ru', 'en', 'eo'];
    const idx = order.indexOf(state.language);
    const next = order[(idx + 1) % order.length];
    ls?.setItem(LANGUAGE_KEY, next);
    applyHtmlLang(next);
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
