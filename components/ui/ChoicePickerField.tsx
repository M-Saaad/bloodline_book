import { useState } from 'react';
import { Modal, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HerdRow } from '@/components/ui/HerdRow';

type ChoiceOption = {
  id: string;
  label: string;
  detail?: string;
};

type ChoicePickerFieldProps = {
  label: string;
  options: ChoiceOption[];
  value: string | null;
  onChange: (id: string) => void;
  emptyMessage: string;
  placeholder?: string;
};

export function ChoicePickerField({
  label,
  options,
  value,
  onChange,
  emptyMessage,
  placeholder = 'Not set',
}: ChoicePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= 900;
  const selected = options.find((option) => option.id === value);

  return (
    <View className="mb-4">
      <Pressable
        onPress={() => setOpen(true)}
        disabled={options.length === 0}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${selected?.label ?? placeholder}. Change`}
        className="min-h-[56px] flex-row items-center rounded-xl border border-gray-300 bg-white px-3 py-3">
        <View className="flex-1 pr-3">
          <Text className="text-sm font-medium text-gray-700">{label}</Text>
          <Text numberOfLines={1} className="text-base font-semibold text-gray-900 mt-0.5">
            {options.length === 0 ? emptyMessage : (selected?.label ?? placeholder)}
          </Text>
        </View>
        {options.length > 0 ? (
          <Text className="text-bloodline-700 font-semibold">Change</Text>
        ) : null}
      </Pressable>

      <Modal
        visible={open}
        animationType={wide ? 'fade' : 'slide'}
        transparent={wide}
        onRequestClose={() => setOpen(false)}>
        <View
          className={
            wide
              ? 'flex-1 bg-black/40 items-center justify-center p-6'
              : 'flex-1 bg-white'
          }
          style={wide ? undefined : { paddingTop: insets.top }}>
          <View
            className={
              wide
                ? 'bg-white rounded-2xl w-full overflow-hidden'
                : 'flex-1 bg-white'
            }
            style={wide ? { maxWidth: 480, width: '100%', maxHeight: '80%' } : undefined}>
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
              <Text className="text-lg font-semibold text-gray-900">{label}</Text>
              <Pressable
                onPress={() => setOpen(false)}
                accessibilityRole="button"
                className="min-h-[44px] justify-center px-2">
                <Text className="text-bloodline-700 font-semibold">Close</Text>
              </Pressable>
            </View>
            <View className="p-4" style={{ paddingBottom: insets.bottom + 16 }}>
              {options.map((option) => (
                <HerdRow
                  key={option.id}
                  title={option.label}
                  subtitle={option.detail}
                  selected={option.id === value}
                  onPress={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                />
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
