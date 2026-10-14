import { View } from 'react-native';

import { Text } from '@/components/ui/Text';

type PilotTextSectionProps = {
  title: string;
  paragraphs: string[];
};

export function PilotTextSection({ title, paragraphs }: PilotTextSectionProps) {
  return (
    <View className="mb-8">
      <Text className="text-[22px] font-extrabold text-ink mb-3">{title}</Text>
      <View className="gap-3">
        {paragraphs.map((paragraph, index) => (
          <Text
            key={index}
            className="text-[18px] leading-[27px] text-gray-800">
            {paragraph}
          </Text>
        ))}
      </View>
    </View>
  );
}
