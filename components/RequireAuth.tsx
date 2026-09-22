import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, isLoading, isConfigured } = useAuth();

  if (!isConfigured) {
    return <Redirect href="/" />;
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#ca4034" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <>{children}</>;
}
