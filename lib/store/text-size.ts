import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';

import {
  DEFAULT_TEXT_SIZE,
  TEXT_SIZE_STORAGE_KEY,
  parseTextSize,
  scaleForTextSize,
  type TextSizeKey,
} from '@/lib/ui/text-scale';

type TextSizeState = {
  size: TextSizeKey;
  scale: number;
  hydrated: boolean;
  setSize: (size: TextSizeKey) => void;
  hydrate: () => Promise<void>;
};

/** Device-only preference: AsyncStorage on the phone, localStorage on web. */
export const useTextSizeStore = create<TextSizeState>((set) => ({
  size: DEFAULT_TEXT_SIZE,
  scale: scaleForTextSize(DEFAULT_TEXT_SIZE),
  hydrated: false,
  setSize: (size) => {
    set({ size, scale: scaleForTextSize(size) });
    AsyncStorage.setItem(TEXT_SIZE_STORAGE_KEY, size).catch(() => {
      // The choice still applies for this session if storage fails.
    });
  },
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(TEXT_SIZE_STORAGE_KEY);
      const size = parseTextSize(raw);
      set({ size, scale: scaleForTextSize(size), hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));

/**
 * Scale to apply to text sizes in JavaScript. On the web build NativeWind
 * turns classes into CSS, so font sizes are not available to scale; the web
 * build zooms the whole page instead (see WebTextZoom) and this returns 1.
 */
export function useTextScale(): number {
  const scale = useTextSizeStore((state) => state.scale);
  return Platform.OS === 'web' ? 1 : scale;
}
