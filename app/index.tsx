import { Redirect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { useFarm } from '@/providers/FarmProvider';
import { useAuth } from '@/providers/AuthProvider';

export default function IndexScreen() {
  const { isLoading: authLoading, session, isConfigured } = useAuth();
  const { farms, activeFarm, isLoading: farmsLoading } = useFarm();

  if (!isConfigured) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-6">
        <Text className="text-2xl font-bold text-bloodline-800 mb-2">
          Bloodline Book
        </Text>
        <Text className="text-center text-gray-600">
          Copy .env.example to .env and set your Supabase and PowerSync
          credentials, then restart the dev server.
        </Text>
      </View>
    );
  }

  if (authLoading || (session && farmsLoading)) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#ca4034" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (farms.length === 0 && !activeFarm) {
    return <Redirect href="/(onboarding)/create-farm" />;
  }

  return <Redirect href="/(tabs)/dashboard" />;
}
