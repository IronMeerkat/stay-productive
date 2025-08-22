import { create } from 'zustand';

type UiState = {
  initialized: boolean;
};

type UiActions = {
  setInitialized: (value: boolean) => void;
};

export const useUiStore = create<UiState & UiActions>(set => ({
  initialized: false,
  setInitialized: (value: boolean) => set({ initialized: value }),
}));
