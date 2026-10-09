import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/Text';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const;

type WeighKeypadProps = {
  onKey: (key: (typeof KEYS)[number]) => void;
};

export function WeighKeypad({ onKey }: WeighKeypadProps) {
  return (
    <View className="flex-row flex-wrap -mx-1">
      {KEYS.map((key) => (
        <View key={key} className="w-1/3 p-1">
          <Pressable
            onPress={() => onKey(key)}
            accessibilityRole="button"
            accessibilityLabel={key === 'del' ? 'Delete' : key}
            className={`h-16 rounded-[18px] items-center justify-center ${
              key === 'del'
                ? 'bg-gray-100 active:bg-gray-200'
                : 'border border-gray-200 bg-white active:bg-bloodline-50'
            }`}>
            <Text className="text-[28px] font-bold text-ink">
              {key === 'del' ? '⌫' : key}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

export function applyWeighKey(current: string, key: (typeof KEYS)[number]): string {
  if (key === 'del') {
    return current.slice(0, -1);
  }
  if (key === '.' && current.includes('.')) {
    return current;
  }
  if (current.length >= 7) {
    return current;
  }
  if (current === '0' && key !== '.') {
    return key;
  }
  return `${current}${key}`;
}
