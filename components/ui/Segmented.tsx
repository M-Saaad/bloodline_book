import { Pressable, Text, View } from 'react-native';

type SegmentedProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

/** 2 to 3 choices in one bar. Selected is brand red. */
export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <View className="flex-row gap-1 p-1 bg-white border border-gray-300 rounded-[19px]">
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            className={`flex-1 h-12 rounded-[15px] items-center justify-center ${
              on ? 'bg-bloodline-600' : ''
            }`}>
            <Text className={`text-[17px] ${on ? 'text-white font-extrabold' : 'text-ink font-bold'}`}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
