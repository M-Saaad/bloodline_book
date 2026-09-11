import { Text, View } from 'react-native';

type FormMessageTone = 'error' | 'success' | 'info';

interface FormMessageProps {
  message: string;
  tone?: FormMessageTone;
}

const toneClasses: Record<FormMessageTone, string> = {
  error: 'bg-red-50 border-red-200',
  success: 'bg-green-50 border-green-200',
  info: 'bg-blue-50 border-blue-200',
};

const textClasses: Record<FormMessageTone, string> = {
  error: 'text-red-800',
  success: 'text-green-800',
  info: 'text-blue-800',
};

export function FormMessage({ message, tone = 'error' }: FormMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <View
      className={`rounded-xl border px-4 py-3 mb-4 ${toneClasses[tone]}`}
      accessibilityRole="alert">
      <Text className={`text-sm ${textClasses[tone]}`}>{message}</Text>
    </View>
  );
}
