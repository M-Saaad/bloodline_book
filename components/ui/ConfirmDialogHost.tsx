import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { registerConfirmOpener } from '@/lib/ui/confirm';

type ActiveConfirm = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  resolve: (confirmed: boolean) => void;
};

export function ConfirmDialogHost() {
  const [active, setActive] = useState<ActiveConfirm | null>(null);

  useEffect(() => {
    return registerConfirmOpener((request) => {
      setActive(request);
    });
  }, []);

  function finish(confirmed: boolean) {
    const current = active;
    setActive(null);
    current?.resolve(confirmed);
  }

  return (
    <Modal
      visible={active != null}
      transparent
      animationType="fade"
      onRequestClose={() => finish(false)}>
      <Pressable
        className="flex-1 bg-black/40 justify-center px-6"
        onPress={() => finish(false)}>
        <Pressable
          className="bg-white rounded-2xl p-5 max-w-md w-full self-center"
          onPress={(event) => event.stopPropagation()}>
          <Text className="text-lg font-semibold text-gray-900">
            {active?.title}
          </Text>
          {active?.message ? (
            <Text className="text-gray-600 mt-2">{active.message}</Text>
          ) : null}
          <View className="flex-row gap-2 mt-5">
            <Button
              title={active?.cancelLabel ?? 'Cancel'}
              variant="secondary"
              onPress={() => finish(false)}
              className="flex-1"
            />
            <Button
              title={active?.confirmLabel ?? 'Confirm'}
              onPress={() => finish(true)}
              className="flex-1"
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
