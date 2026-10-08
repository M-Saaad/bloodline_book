import { Text } from 'react-native';

/** Label above a group of chips, a segmented bar or a picker. */
export function FieldLabel({ children, optional = false }: { children: string; optional?: boolean }) {
  return (
    <Text className="text-base font-bold text-ink mb-2">
      {children}
      {optional ? <Text className="font-medium text-gray-500"> optional</Text> : null}
    </Text>
  );
}
