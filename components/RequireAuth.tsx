import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { signedInEntryRoute } from '@/lib/auth/recovery-routing';
import { useAuth } from '@/providers/AuthProvider';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const {
    session,
    isLoading,
    isConfigured,
    recoveryPending,
    recoveryLinkError,
  } = useAuth();

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

  const entryRoute = signedInEntryRoute({
    recoveryPending,
    hasSession: session != null,
  });

  if (entryRoute === 'sign-in') {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (entryRoute === 'reset-password' || recoveryLinkError) {
    return <Redirect href="/(auth)/reset-password" />;
  }

  return <>{children}</>;
}
