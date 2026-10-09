import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';

import {
  DEFAULT_TEXT_SIZE,
  LEGACY_TEXT_SIZE_STORAGE_KEY,
  TEXT_SIZE_ONBOARDING_KEY,
  TEXT_SIZE_STORAGE_KEY,
  isTextSizeKey,
  isTextSizeOnboardingComplete,
  migrateLegacyStoredTextSize,
  parseTextSize,
  scaleForTextSize,
  type TextSizeKey,
} from '@/lib/ui/text-scale';

type TextSizeState = {
  size: TextSizeKey;
  scale: number;
  hydrated: boolean;
  onboardingCompleted: boolean;
  setSize: (size: TextSizeKey) => void;
  completeOnboarding: () => Promise<void>;
  hydrate: () => Promise<void>;
};

/** Device-only preference: AsyncStorage on the phone, localStorage on web. */
export const useTextSizeStore = create<TextSizeState>((set) => ({
  size: DEFAULT_TEXT_SIZE,
  scale: scaleForTextSize(DEFAULT_TEXT_SIZE),
  hydrated: false,
  onboardingCompleted: false,
  setSize: (size) => {
    set({ size, scale: scaleForTextSize(size) });
    AsyncStorage.setItem(TEXT_SIZE_STORAGE_KEY, size).catch(() => {
      // The choice still applies for this session if storage fails.
    });
  },
  completeOnboarding: async () => {
    try {
      await AsyncStorage.setItem(TEXT_SIZE_ONBOARDING_KEY, '1');
    } catch {
      // Still let them into the app for this session.
    }
    set({ onboardingCompleted: true });
  },
  hydrate: async () => {
    try {
      const [v2Raw, legacyRaw, onboardingFlag] = await Promise.all([
        AsyncStorage.getItem(TEXT_SIZE_STORAGE_KEY),
        AsyncStorage.getItem(LEGACY_TEXT_SIZE_STORAGE_KEY),
        AsyncStorage.getItem(TEXT_SIZE_ONBOARDING_KEY),
      ]);

      let raw = v2Raw;
      if (raw == null) {
        if (legacyRaw != null && isTextSizeKey(legacyRaw)) {
          const migrated = migrateLegacyStoredTextSize(legacyRaw);
          raw = migrated;
          await AsyncStorage.setItem(TEXT_SIZE_STORAGE_KEY, migrated);
        }
      }

      const size = parseTextSize(raw);
      const onboardingCompleted = isTextSizeOnboardingComplete(
        onboardingFlag,
        v2Raw,
        legacyRaw,
      );

      set({
        size,
        scale: scaleForTextSize(size),
        onboardingCompleted,
        hydrated: true,
      });
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
