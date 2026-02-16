import { create } from 'zustand';

export type SidebarTab = 'participants' | 'chat' | 'transcript';

interface UIState {
  sidebarOpen: boolean;
  sidebarTab: SidebarTab;
  mobileMenuOpen: boolean;
  defaultLanguage: string;
  defaultModel: string;

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  setMobileMenuOpen: (open: boolean) => void;
  setDefaultLanguage: (lang: string) => void;
  setDefaultModel: (model: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: false,
  sidebarTab: 'participants',
  mobileMenuOpen: false,
  defaultLanguage: 'en',
  defaultModel: 'llama3.2:3b',

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setSidebarTab: (sidebarTab) => set({ sidebarTab, sidebarOpen: true }),
  setMobileMenuOpen: (mobileMenuOpen) => set({ mobileMenuOpen }),
  setDefaultLanguage: (defaultLanguage) => set({ defaultLanguage }),
  setDefaultModel: (defaultModel) => set({ defaultModel }),
}));
