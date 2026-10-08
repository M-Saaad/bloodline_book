import { Text, View } from 'react-native';

/** Big screen heading with a small line under it, like the boards. */
export function PageHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View>
      <Text accessibilityRole="header" className="text-[32px] leading-[35px] font-extrabold text-ink">
        {title}
      </Text>
      {subtitle ? (
        <Text className="text-[15px] font-semibold text-gray-500">{subtitle}</Text>
      ) : null}
    </View>
  );
}

/** Section title used above cards. */
export function SectionTitle({ children, right }: { children: string; right?: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-xl font-extrabold text-ink">{children}</Text>
      {right}
    </View>
  );
}

/** Goat name with the tag number in brand red next to it. */
export function GoatName({
  label,
  tag,
  className = 'text-lg font-extrabold text-ink',
}: {
  label: string;
  tag?: string | null;
  className?: string;
}) {
  if (label.startsWith('#')) {
    return <Text className={`${className} text-bloodline-600`}>{label}</Text>;
  }
  return (
    <Text className={className}>
      {label}
      {tag ? <Text className="text-bloodline-600"> #{tag}</Text> : null}
    </Text>
  );
}
