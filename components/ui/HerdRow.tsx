import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/Text';

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
      className={`min-h-[64px] rounded-[18px] border-2 px-4 py-3 mb-2 ${
        disabled
          ? 'border-gray-200 bg-gray-100'
          : selected
            ? 'border-bloodline-600 bg-bloodline-100'
            : 'border-gray-200 bg-white'
      }`}>
      <View className="flex-row items-center">
        <View className="flex-1 pr-3">
          <Text
            numberOfLines={1}
            className={`text-lg font-extrabold ${disabled ? 'text-gray-500' : 'text-ink'}`}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} className="text-[15px] mt-0.5 text-gray-500">
              {subtitle}
            </Text>
          ) : null}
        </View>
        {trailing ? (
          <Text className="text-[15px] font-bold text-gray-700">{trailing}</Text>
        ) : null}
        {selected ? <Text className="text-2xl font-extrabold text-bloodline-600 ml-2">✓</Text> : null}
      </View>
    </Pressable>
  );
}
