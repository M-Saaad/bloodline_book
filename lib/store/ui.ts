import { create } from 'zustand';

interface UiState {
  activeFarmId: string | null;
  setActiveFarmId: (farmId: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeFarmId: null,
  setActiveFarmId: (farmId) => set({ activeFarmId: farmId }),
}));
