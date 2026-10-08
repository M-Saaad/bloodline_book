import { Pressable, Text, View } from 'react-native';

type ListRowProps = {
  title: string;
  /** Tag number, shown in brand red next to the name. */
  tag?: string | null;
  subtitle?: string;
  /** Anything on the right: a Badge, a value, a chevron. */
  right?: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
  disabled?: boolean;
};

/** One row inside a ListCard. At least 72 px tall so it is easy to hit. */
export function ListRow({ title, tag, subtitle, right, onPress, last = false, disabled = false }: ListRowProps) {
  const inner = (
    <View
      className={`flex-row items-center gap-3 min-h-[72px] px-4 py-2.5 ${
        last ? '' : 'border-b border-gray-100'
      } ${disabled ? 'opacity-60' : ''}`}>
      <View className="flex-1">
        <Text className="text-lg font-extrabold text-ink" numberOfLines={2}>
          {title}
          {tag ? <Text className="text-bloodline-600"> {tag}</Text> : null}
        </Text>
        {subtitle ? (
          <Text className="text-[15px] text-gray-500 mt-0.5" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
  if (!onPress) {
    return inner;
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="active:bg-gray-50">
      {inner}
    </Pressable>
  );
}

/** White rounded card that holds ListRows. */
export function ListCard({ children }: { children: React.ReactNode }) {
  return (
    <View className="bg-white border border-gray-200 rounded-[22px] overflow-hidden">{children}</View>
  );
}

export function Chevron() {
  return <Text className="text-2xl text-gray-500">›</Text>;
}
