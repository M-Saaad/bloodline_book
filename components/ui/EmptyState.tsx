import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';

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
      <View className="w-16 h-16 rounded-full bg-bloodline-100 items-center justify-center mb-4">
        <Text className="text-3xl text-bloodline-600">✚</Text>
      </View>
      <Text className="text-[22px] font-extrabold text-ink text-center mb-2">
        {title}
      </Text>
      {description ? (
        <Text className="text-base leading-[22px] text-gray-500 text-center mb-5">{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} className="min-w-[220px]" />
      ) : null}
    </View>
  );
}
