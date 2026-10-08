import { ActivityIndicator, Text, View } from 'react-native';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading…' }: LoadingStateProps) {
  return (
    <View className="flex-1 items-center justify-center bg-paper px-6">
      <ActivityIndicator size="large" color="#a52f1a" />
      <Text className="text-base font-semibold text-gray-500 mt-3">{message}</Text>
    </View>
  );
}
