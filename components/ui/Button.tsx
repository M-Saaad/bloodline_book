import { Pressable } from 'react-native';
import { Text } from '@/components/ui/Text';

type ButtonVariant = 'primary' | 'secondary' | 'outline';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  className?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-bloodline-600 border-2 border-bloodline-600 active:bg-bloodline-700',
  secondary: 'bg-bloodline-100 border-2 border-bloodline-100 active:bg-bloodline-200',
  outline: 'bg-white border-2 border-bloodline-600 active:bg-bloodline-50',
};

const textClasses: Record<ButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'text-bloodline-900',
  outline: 'text-bloodline-600',
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  className = '',
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className={`min-h-[56px] rounded-2xl px-5 py-3 items-center justify-center ${variantClasses[variant]} ${
        disabled ? 'opacity-50' : ''
      } ${className}`}>
      <Text className={`font-extrabold text-lg ${textClasses[variant]}`}>
        {title}
      </Text>
    </Pressable>
  );
}
