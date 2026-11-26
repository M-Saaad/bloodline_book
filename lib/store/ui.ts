import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import {
  parseRememberedFarm,
  type RememberedFarm,
} from '@/lib/domain/active-farm';

/** Device setting: AsyncStorage on native, localStorage on web. */
export const ACTIVE_FARM_STORAGE_KEY = 'bloodline.activeFarmId';

interface UiState {
  activeFarmId: string | null;
  rememberedFarm: RememberedFarm | null;
  activeFarmHydrated: boolean;
  /** In-memory only. Used for the automatic farms[0] fallback. */
  setActiveFarmId: (farmId: string | null) => void;
  /** User chose this farm. Kept for the next launch of the same account. */
  rememberActiveFarmId: (userId: string, farmId: string) => void;
  clearRememberedFarmId: () => Promise<void>;
  hydrateActiveFarm: () => Promise<void>;
}

export const useUiStore = create<UiState>((set, get) => ({
  activeFarmId: null,
  rememberedFarm: null,
  activeFarmHydrated: false,
  setActiveFarmId: (farmId) => set({ activeFarmId: farmId }),
  rememberActiveFarmId: (userId, farmId) => {
    const rememberedFarm = { userId, farmId };
    set({ activeFarmId: farmId, rememberedFarm });
    if (!get().activeFarmHydrated) {
      return;
    }
    AsyncStorage.setItem(
      ACTIVE_FARM_STORAGE_KEY,
      JSON.stringify(rememberedFarm),
    ).catch(() => {
      // The choice still applies for this session if storage fails.
    });
  },
  clearRememberedFarmId: async () => {
    set({ activeFarmId: null, rememberedFarm: null });
    try {
      await AsyncStorage.removeItem(ACTIVE_FARM_STORAGE_KEY);
    } catch {
      // Memory is already cleared, so the next account on this device
      // will not keep the previous choice for this session.
    }
  },
  hydrateActiveFarm: async () => {
    try {
      const raw = await AsyncStorage.getItem(ACTIVE_FARM_STORAGE_KEY);
      set({
        rememberedFarm: parseRememberedFarm(raw),
        activeFarmHydrated: true,
      });
    } catch {
      set({ activeFarmHydrated: true });
    }
  },
}));
