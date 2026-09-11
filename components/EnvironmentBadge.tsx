import { Text, View } from 'react-native';

import { isDevelopment } from '@/lib/config/environment';

export function EnvironmentBadge() {
  if (!isDevelopment) {
    return null;
  }

  return (
    <View className="self-start rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 mb-2">
      <Text className="text-xs font-semibold text-amber-800">DEV</Text>
    </View>
  );
}
