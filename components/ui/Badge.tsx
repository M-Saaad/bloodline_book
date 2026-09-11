import { Text, View } from 'react-native';

interface BadgeProps {
  label: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}

const toneClasses = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
};

export function Badge({ label, tone = 'default' }: BadgeProps) {
  const classes = toneClasses[tone];
  const [bg, text] = classes.split(' ');

  return (
    <View className={`rounded-full px-2 py-0.5 ${bg}`}>
      <Text className={`text-xs font-medium ${text}`}>{label}</Text>
    </View>
  );
}
