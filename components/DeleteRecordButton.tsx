import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { confirmAction } from '@/lib/ui/confirm';

type DeleteRecordButtonProps = {
  title?: string;
  confirmTitle: string;
  confirmMessage: string;
  onDelete: () => Promise<void>;
  disabled?: boolean;
  disabledReason?: string;
  /** Plain sentence under the button, for example what else gets deleted. */
  note?: string;
};

export function DeleteRecordButton({
  title = 'Delete',
  confirmTitle,
  confirmMessage,
  onDelete,
  disabled = false,
  disabledReason,
  note,
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

  const blocked = disabled || deleting;

  return (
    <View className="mt-6 pt-2">
      <Pressable
        onPress={handlePress}
        disabled={blocked}
        accessibilityRole="button"
        accessibilityLabel={title}
        className={`min-h-[56px] rounded-[18px] bg-stop border-[2.5px] border-stop px-5 py-3 flex-row items-center justify-center gap-2.5 active:opacity-80 ${
          blocked ? 'opacity-50' : ''
        }`}>
        <Text className="text-xl text-white">🗑︎</Text>
        <Text className="text-[19px] font-extrabold text-white">
          {deleting ? 'Deleting…' : title}
        </Text>
      </Pressable>
      {!(disabled && disabledReason) && note ? (
        <Text className="text-[15px] leading-[21px] text-gray-500 mt-2">{note}</Text>
      ) : null}
      {disabled && disabledReason ? (
        <Text className="text-[15px] leading-[21px] text-gray-500 mt-2">{disabledReason}</Text>
      ) : null}
    </View>
  );
}
