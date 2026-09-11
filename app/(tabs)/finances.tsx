import { Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';

export default function FinancesScreen() {
  return (
    <View className="flex-1 bg-gray-50 p-4">
      <Card>
        <Text className="text-lg font-semibold text-gray-900 mb-2">
          Finances
        </Text>
        <Text className="text-gray-600">
          Transaction tracking arrives in Phase 1 (migration 0007).
        </Text>
      </Card>
    </View>
  );
}
