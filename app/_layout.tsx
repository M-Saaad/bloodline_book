import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import '../global.css';

import { WebTextZoom } from '@/components/WebTextZoom';
import { WebUploadQueueWarning } from '@/components/WebUploadQueueWarning';
import { ConfirmDialogHost } from '@/components/ui/ConfirmDialogHost';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { FarmProvider, useFarm } from '@/providers/FarmProvider';
import { useTextSizeStore } from '@/lib/store/text-size';
import { PowerSyncProvider } from '@/providers/PowerSyncProvider';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

/** The splash never stays up longer than this, whatever is still loading. */
const SPLASH_MAX_MS = 4000;

function hideSplash() {
  SplashScreen.hideAsync().catch(() => {
    // Already hidden.
  });
}

/**
 * Keeps the splash up until the saved session and farm list are resolved, so
 * the first thing a farmer sees is the sign-in or Today screen, not a spinner.
 */
function SplashGate() {
  const { isLoading: authLoading, session } = useAuth();
  const { isLoading: farmsLoading } = useFarm();
  const ready = !authLoading && !(session && farmsLoading);

  useEffect(() => {
    if (ready) {
      hideSplash();
    }
  }, [ready]);

  return null;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  const textSizeHydrated = useTextSizeStore((state) => state.hydrated);

  useEffect(() => {
    useTextSizeStore.getState().hydrate();
    const timer = setTimeout(() => {
      // Never leave a farmer on a blank screen if storage is slow.
      useTextSizeStore.setState({ hydrated: true });
      hideSplash();
    }, SPLASH_MAX_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!loaded || !textSizeHydrated) {
    return null;
  }

  return (
    <AuthProvider>
      <PowerSyncProvider>
        <FarmProvider>
          <WebTextZoom />
          <SplashGate />
          <ConfirmDialogHost />
          <WebUploadQueueWarning />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="choose-text-size" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(onboarding)" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </FarmProvider>
      </PowerSyncProvider>
    </AuthProvider>
  );
}
