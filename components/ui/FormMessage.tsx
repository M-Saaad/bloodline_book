import { View } from 'react-native';
import { Text } from '@/components/ui/Text';

type FormMessageTone = 'error' | 'success' | 'info' | 'warning';

interface FormMessageProps {
  message: string;
  tone?: FormMessageTone;
}

// Errors are black with a warning symbol: red is the brand color, so it never means "stop".
const toneClasses: Record<FormMessageTone, string> = {
  error: 'bg-stop',
  success: 'bg-[#ddf0e4]',
  info: 'bg-[#e1edf8]',
  warning: 'bg-[#fff1cc]',
};

const textClasses: Record<FormMessageTone, string> = {
  error: 'text-white',
  success: 'text-[#0f5a33]',
  info: 'text-[#17476f]',
  warning: 'text-[#6b3a00]',
};

const symbols: Record<FormMessageTone, string> = {
  error: '⚠',
  success: '✓',
  info: 'ⓘ',
  warning: '◔',
};

export function FormMessage({ message, tone = 'error' }: FormMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <View
      className={`rounded-[18px] px-4 py-3.5 mb-4 flex-row gap-3 ${toneClasses[tone]}`}
      accessibilityRole="alert">
      <Text className={`text-xl ${textClasses[tone]}`}>{symbols[tone]}</Text>
      <Text className={`flex-1 text-base font-semibold leading-[22px] ${textClasses[tone]}`}>
        {message}
      </Text>
    </View>
  );
}
