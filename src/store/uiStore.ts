import { create } from 'zustand';

type Screen = 'menu' | 'game' | 'history' | 'rules' | 'settings';
export type Language = 'ru' | 'en' | 'eo';

const LANGUAGE_KEY = 'zertz_language';

function getInitialLanguage(): Language {
  const saved = localStorage.getItem(LANGUAGE_KEY);
  if (saved === 'en' || saved === 'eo' || saved === 'ru') return saved;
  return 'ru';
}

interface UIStore {
  screen: Screen;
  previousScreen: Screen;
  isDarkMode: boolean;
  showMoveHistory: boolean;
  language: Language;
  
  setScreen: (screen: Screen) => void;
  openRules: () => void;
  toggleDarkMode: () => void;
  toggleMoveHistory: () => void;
  setLanguage: (language: Language) => void;
  cycleLanguage: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  screen: 'menu',
  previousScreen: 'menu',
  isDarkMode: false,
  showMoveHistory: false,
  language: getInitialLanguage(),
  
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
}));
