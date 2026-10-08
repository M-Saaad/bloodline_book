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
      <Text className="text-base font-bold text-ink mb-2">{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={options.length === 0}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${selected?.label ?? placeholder}. Change`}
        className="h-14 flex-row items-center rounded-[18px] border border-gray-300 bg-white px-4">
        <Text
          numberOfLines={1}
          className={`flex-1 text-lg ${selected ? 'font-bold text-ink' : 'text-gray-500'}`}>
          {options.length === 0 ? emptyMessage : (selected?.label ?? placeholder)}
        </Text>
        {options.length > 0 ? <Text className="text-2xl text-gray-500">›</Text> : null}
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
              : 'flex-1 bg-paper'
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
              <Text className="text-xl font-extrabold text-ink">{label}</Text>
              <Pressable
                onPress={() => setOpen(false)}
                accessibilityRole="button"
                className="min-h-[44px] justify-center px-2">
                <Text className="text-base font-bold text-bloodline-600">Close</Text>
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
