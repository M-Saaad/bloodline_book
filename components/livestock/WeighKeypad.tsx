import { Pressable, Text, View } from 'react-native';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const;

type WeighKeypadProps = {
  onKey: (key: (typeof KEYS)[number]) => void;
};

export function WeighKeypad({ onKey }: WeighKeypadProps) {
  return (
    <View className="flex-row flex-wrap">
      {KEYS.map((key) => (
        <Pressable
          key={key}
          onPress={() => onKey(key)}
          accessibilityRole="button"
          accessibilityLabel={key === 'del' ? 'Delete' : key}
          className="w-1/3 h-16 items-center justify-center border border-gray-200 bg-white active:bg-gray-100">
          <Text className="text-2xl font-semibold text-gray-900">
            {key === 'del' ? '⌫' : key}
          </Text>
        </Pressable>
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
