import { create } from 'zustand';

type Screen = 'menu' | 'game' | 'history' | 'rules' | 'settings';

interface UIStore {
  screen: Screen;
  previousScreen: Screen;
  isDarkMode: boolean;
  showMoveHistory: boolean;
  
  setScreen: (screen: Screen) => void;
  openRules: () => void;
  toggleDarkMode: () => void;
  toggleMoveHistory: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  screen: 'menu',
  previousScreen: 'menu',
  isDarkMode: false,
  showMoveHistory: false,
  
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
}));
