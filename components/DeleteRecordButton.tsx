import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { confirmAction } from '@/lib/ui/confirm';

type DeleteRecordButtonProps = {
  title?: string;
  confirmTitle: string;
  confirmMessage: string;
  onDelete: () => Promise<void>;
  disabled?: boolean;
  disabledReason?: string;
};

export function DeleteRecordButton({
  title = 'Delete',
  confirmTitle,
  confirmMessage,
  onDelete,
  disabled = false,
  disabledReason,
}: DeleteRecordButtonProps) {
  const [deleting, setDeleting] = useState(false);

  async function handlePress() {
    const confirmed = await confirmAction(
      confirmTitle,
      confirmMessage,
      'Delete',
    );
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <View className="mt-8 pt-6 border-t border-gray-200">
      {disabled && disabledReason ? (
        <Text className="text-gray-600 text-sm mb-3">{disabledReason}</Text>
      ) : null}
      <Button
        title={deleting ? 'Deleting…' : title}
        variant="outline"
        onPress={handlePress}
        disabled={disabled || deleting}
        className="border-red-300"
      />
    </View>
  );
}
