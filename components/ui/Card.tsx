import { View, type ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  className?: string;
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <View
      className={`rounded-[22px] bg-white border border-gray-200 p-4 ${className}`}
      {...props}>
      {children}
    </View>
  );
}
