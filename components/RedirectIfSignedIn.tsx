import { Redirect, useSegments } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';

export function RedirectIfSignedIn({ children }: { children: React.ReactNode }) {
  const { session, isLoading, isConfigured } = useAuth();
  const segments = useSegments();
  const onResetPassword = (segments as readonly string[]).includes(
    'reset-password',
  );

  if (!isConfigured) {
    return <Redirect href="/" />;
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator size="large" color="#a52f1a" />
      </View>
    );
  }

  if (session && !onResetPassword) {
    return <Redirect href="/" />;
  }

  return <>{children}</>;
}
