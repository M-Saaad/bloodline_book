import { Pressable, Text, View } from 'react-native';

type ChipProps = {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
};

/** One tappable choice. Selected is dark red with white text. */
export function Chip({ label, selected = false, disabled = false, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      className={`h-12 px-[18px] rounded-full items-center justify-center border ${
        selected
          ? 'bg-bloodline-900 border-bloodline-900'
          : 'bg-white border-gray-300'
      } ${disabled ? 'opacity-50' : ''}`}>
      <Text
        className={`text-[17px] ${
          selected ? 'text-white font-bold' : 'text-ink font-semibold'
        }`}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Wrapping row of chips. */
export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View className="flex-row flex-wrap gap-2">{children}</View>;
}
