import { Text, View } from 'react-native';

import {
  databaseLabel,
  isProductionDatabase,
} from '@/lib/config/database';

export function EnvironmentBadge() {
  if (isProductionDatabase || !__DEV__) {
    return null;
  }

  return (
    <View className="self-start rounded-full bg-[#fff1cc] border border-[#e5c77a] px-3 py-1 mb-2">
      <Text className="text-sm font-bold text-[#6b3a00]">
        {databaseLabel}
      </Text>
    </View>
  );
}
