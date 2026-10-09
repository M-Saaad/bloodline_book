import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { TEXT_SIZE_OPTIONS, type TextSizeKey } from '@/lib/ui/text-scale';

type TextSizeOptionsListProps = {
  selected: TextSizeKey;
  onSelect: (key: TextSizeKey) => void;
};

export function TextSizeOptionsList({ selected, onSelect }: TextSizeOptionsListProps) {
  return (
    <View className="gap-2">
      {TEXT_SIZE_OPTIONS.map((option) => {
        const on = option.key === selected;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`Text size ${option.label}`}
            onPress={() => onSelect(option.key)}
            className={`min-h-[52px] flex-row items-center rounded-2xl border px-4 py-2 ${
              on ? 'bg-bloodline-600 border-bloodline-600' : 'bg-white border-gray-300'
            }`}>
            <Text
              className={`text-[17px] ${on ? 'text-white font-extrabold' : 'text-ink font-bold'}`}>
              {option.label}
            </Text>
            {on ? (
              <Text className="ml-auto text-[17px] font-extrabold text-white">✓</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function TextSizePreviewSample() {
  return (
    <Text className="text-[17px] leading-6 text-ink mt-4">
      Preview: Daisy is due to kid in 12 days. Meat withdrawal ends on May 3.
    </Text>
  );
}
