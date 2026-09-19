import { Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';

export default function LandScreen() {
  return (
    <View className="flex-1 bg-gray-50 p-4">
      <Card>
        <Text className="text-lg font-semibold text-gray-900 mb-2">
          Pastures & Land
        </Text>
        <Text className="text-gray-600">
          Pasture management arrives in Phase 3 (future migration; 0005–0006 reserved for health/breeding).
        </Text>
      </Card>
    </View>
  );
}
