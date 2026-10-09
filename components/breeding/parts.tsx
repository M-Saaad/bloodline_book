import { View } from 'react-native';
import { Text } from '@/components/ui/Text';

type NameSource = {
  id: string;
  name?: string | null;
  tagNumber?: string | null;
};

/** Splits a goat into a name and a tag so the tag can be shown in brand red. */
export function goatParts(animal: NameSource): { name: string; tag: string | null } {
  const name = animal.name?.trim();
  const tag = animal.tagNumber?.trim();
  if (name) {
    return { name, tag: tag ? `#${tag}` : null };
  }
  if (tag) {
    return { name: '', tag: `#${tag}` };
  }
  return { name: `Animal ${animal.id.slice(0, 8)}`, tag: null };
}

/** Section heading, 20px extra bold. */
export function SectionTitle({ children }: { children: string }) {
  return <Text className="text-xl font-extrabold text-ink mb-2">{children}</Text>;
}

/** Big screen heading with a small line under it (used by list screens). */
export function ScreenHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="pt-2">
      <Text className="text-[32px] leading-[36px] font-extrabold text-ink">{title}</Text>
      {subtitle ? (
        <Text className="text-[15px] font-semibold text-gray-500">{subtitle}</Text>
      ) : null}
    </View>
  );
}

/** White card showing one goat or value: small label, big name with red tag. */
export function InfoCard({
  label,
  name,
  tag,
  detail,
}: {
  label: string;
  name: string;
  tag?: string | null;
  detail?: string;
}) {
  return (
    <View className="bg-white border border-gray-200 rounded-[22px] px-4 py-3">
      <Text className="text-[15px] font-semibold text-gray-500">{label}</Text>
      <Text className="text-[22px] font-extrabold text-ink">
        {name}
        {tag ? <Text className="text-bloodline-600"> {tag}</Text> : null}
      </Text>
      {detail ? <Text className="text-[15px] text-gray-500 mt-0.5">{detail}</Text> : null}
    </View>
  );
}

/**
 * Wraps one row of a FlatList so the rows together look like one rounded white card.
 * Pass the row's index and the total number of rows.
 */
export function CardRowShell({
  index,
  count,
  children,
}: {
  index: number;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <View
      className={`bg-white border-x border-gray-200 overflow-hidden ${
        index === 0 ? 'border-t rounded-t-[22px]' : ''
      } ${index === count - 1 ? 'border-b rounded-b-[22px]' : ''}`}>
      {children}
    </View>
  );
}

/** Renders text with any #tag number picked out in brand red. */
export function TextWithTags({ text }: { text: string }) {
  const pieces = text.split(/(#[A-Za-z0-9-]+)/g);
  return (
    <>
      {pieces.map((piece, i) =>
        /^#[A-Za-z0-9-]+$/.test(piece) ? (
          <Text key={i} className="text-bloodline-600">
            {piece}
          </Text>
        ) : (
          piece
        ),
      )}
    </>
  );
}
