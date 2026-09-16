import { ActivityIndicator, Text, View } from 'react-native';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading…' }: LoadingStateProps) {
  return (
    <View className="flex-1 items-center justify-center bg-gray-50 px-6">
      <ActivityIndicator size="large" color="#ca4034" />
      <Text className="text-gray-500 mt-3">{message}</Text>
    </View>
  );
}
