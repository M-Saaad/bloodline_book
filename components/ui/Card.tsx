import { View, type ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  className?: string;
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <View
      className={`rounded-2xl bg-white border border-gray-200 p-4 shadow-sm ${className}`}
      {...props}>
      {children}
    </View>
  );
}
