import { Text, View } from 'react-native';

import {
  databaseLabel,
  isProductionDatabase,
} from '@/lib/config/database';

export function EnvironmentBadge() {
  if (isProductionDatabase) {
    return null;
  }

  return (
    <View className="self-start rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 mb-2">
      <Text className="text-xs font-semibold text-amber-800">
        {databaseLabel}
      </Text>
    </View>
  );
}
