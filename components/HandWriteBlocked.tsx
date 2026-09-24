import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { ReadOnlyFarmBanner } from '@/components/ReadOnlyFarmBanner';
import { Button } from '@/components/ui/Button';
import { useFarmRole } from '@/hooks/useFarmRole';

export function HandWriteBlocked({ children }: { children: ReactNode }) {
  const { isHand } = useFarmRole();

  if (!isHand) {
    return children;
  }

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="p-4">
      <ReadOnlyFarmBanner />
      <Button title="Go back" variant="outline" onPress={() => router.back()} />
      <View className="h-4" />
    </ScrollView>
  );
}
