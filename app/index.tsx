import { Redirect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';

import { SUPPORT_EMAIL } from '@/lib/config/support';
import { shouldRouteToCreateFarm } from '@/lib/domain/offline-replica';
import { useFarm } from '@/providers/FarmProvider';
import { useAuth } from '@/providers/AuthProvider';

export default function IndexScreen() {
  const { isLoading: authLoading, session, isConfigured } = useAuth();
  const {
    farms,
    activeFarm,
    isLoading: farmsLoading,
    localFarmsResolved,
  } = useFarm();

  if (!isConfigured) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-6">
        <Text className="text-2xl font-bold text-bloodline-800 mb-2">
          Bloodline Book
        </Text>
        <Text className="text-center text-gray-600">
          This app is not set up yet. Try again later or contact support.
        </Text>
        <Text className="text-center text-gray-600 mt-4">
          {SUPPORT_EMAIL}
        </Text>
      </View>
    );
  }

  if (authLoading || (session && farmsLoading)) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#a52f1a" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (
    shouldRouteToCreateFarm({
      localFarmsResolved,
      farmCount: farms.length,
      hasActiveFarm: activeFarm != null,
    })
  ) {
    return <Redirect href="/(onboarding)/create-farm" />;
  }

  return <Redirect href="/(tabs)/dashboard" />;
}
