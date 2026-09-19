import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View className="items-center justify-center px-6 py-12">
      <Text className="text-lg font-semibold text-gray-800 text-center mb-2">
        {title}
      </Text>
      {description ? (
        <Text className="text-gray-500 text-center mb-4">{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} className="min-w-[180px]" />
      ) : null}
    </View>
  );
}
