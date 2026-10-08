import { Text, View } from 'react-native';

interface BadgeProps {
  label: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brand';
}

// Status is shown with a symbol, a word and a color, never color alone.
// `danger` is near black on purpose: red is the brand color, so it cannot mean stop.
const toneClasses = {
  default: { bg: 'bg-gray-100', text: 'text-gray-700', symbol: '' },
  success: { bg: 'bg-[#ddf0e4]', text: 'text-[#0f5a33]', symbol: '✓ ' },
  warning: { bg: 'bg-[#fff1cc]', text: 'text-[#7a4300]', symbol: '◔ ' },
  danger: { bg: 'bg-stop', text: 'text-white', symbol: '⚠ ' },
  info: { bg: 'bg-[#e1edf8]', text: 'text-[#17476f]', symbol: '' },
  brand: { bg: 'bg-bloodline-100', text: 'text-bloodline-900', symbol: '' },
};

export function Badge({ label, tone = 'default' }: BadgeProps) {
  const { bg, text, symbol } = toneClasses[tone];

  return (
    <View className={`rounded-full px-3 py-1 ${bg}`}>
      <Text className={`text-sm font-bold ${text}`}>
        {symbol}
        {label}
      </Text>
    </View>
  );
}
