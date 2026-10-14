import type { ImageSourcePropType } from 'react-native';
import { Image, View } from 'react-native';

import { Text } from '@/components/ui/Text';

type PilotSectionProps = {
  title: string;
  steps: string[];
  image?: ImageSourcePropType;
  imageAlt?: string;
  footer?: React.ReactNode;
};

export function PilotSection({
  title,
  steps,
  image,
  imageAlt,
  footer,
}: PilotSectionProps) {
  return (
    <View className="mb-8">
      <Text className="text-[22px] font-extrabold text-ink mb-3">{title}</Text>
      <View className="gap-3 mb-4">
        {steps.map((step, index) => (
          <View key={index} className="flex-row gap-3">
            <Text className="text-[18px] leading-[27px] font-extrabold text-bloodline-600 w-7">
              {index + 1}.
            </Text>
            <Text className="flex-1 text-[18px] leading-[27px] text-gray-800">
              {step}
            </Text>
          </View>
        ))}
      </View>
      {image ? (
        <Image
          accessibilityLabel={imageAlt ?? title}
          source={image}
          resizeMode="contain"
          className="w-full rounded-2xl border border-gray-200 bg-white"
          style={{ aspectRatio: 390 / 844, maxHeight: 520 }}
        />
      ) : null}
      {footer}
    </View>
  );
}
