import { Pressable, Text } from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'outline';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  className?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-bloodline-600 active:bg-bloodline-700',
  secondary: 'bg-gray-200 active:bg-gray-300',
  outline: 'border border-bloodline-600 bg-transparent active:bg-bloodline-50',
};

const textClasses: Record<ButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'text-gray-900',
  outline: 'text-bloodline-700',
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
      className={`rounded-xl px-4 py-3 items-center ${variantClasses[variant]} ${
        disabled ? 'opacity-50' : ''
      } ${className}`}>
      <Text className={`font-semibold text-base ${textClasses[variant]}`}>
        {title}
      </Text>
    </Pressable>
  );
}
