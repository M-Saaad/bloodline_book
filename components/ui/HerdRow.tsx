import { Pressable, Text, View } from 'react-native';

type HerdRowProps = {
  title: string;
  subtitle?: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  trailing?: string;
};

export function HerdRow({
  title,
  subtitle,
  selected = false,
  disabled = false,
  onPress,
  trailing,
}: HerdRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      className={`min-h-[56px] rounded-xl border px-3 py-3 mb-2 ${
        disabled
          ? 'border-gray-200 bg-gray-100'
          : selected
            ? 'border-bloodline-600 bg-bloodline-600'
            : 'border-gray-300 bg-white'
      }`}>
      <View className="flex-row items-center">
        <View className="flex-1 pr-3">
          <Text
            numberOfLines={1}
            className={`text-base font-semibold ${
              disabled
                ? 'text-gray-600'
                : selected
                  ? 'text-white'
                  : 'text-gray-900'
            }`}>
            {title}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              className={`text-sm mt-0.5 ${
                disabled
                  ? 'text-gray-500'
                  : selected
                    ? 'text-white'
                    : 'text-gray-700'
              }`}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {trailing ? (
          <Text
            className={`text-sm font-semibold ${
              selected ? 'text-white' : 'text-gray-700'
            }`}>
            {trailing}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
