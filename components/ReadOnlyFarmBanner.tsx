import { Text, View } from 'react-native';

export function ReadOnlyFarmBanner() {
  return (
    <View className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
      <Text className="text-amber-900 font-semibold mb-1">View only</Text>
      <Text className="text-amber-900 text-sm">
        Your role on this farm can view records but not add or edit them.
      </Text>
    </View>
  );
}
