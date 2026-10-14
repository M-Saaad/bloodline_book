import type { ImageSourcePropType } from 'react-native';
import { Image, View } from 'react-native';

import { Text } from '@/components/ui/Text';

type GuideStepProps = {
  step: number;
  title: string;
  body: string;
  image: ImageSourcePropType;
  imageAlt: string;
};

export function GuideStep({ step, title, body, image, imageAlt }: GuideStepProps) {
  return (
    <View className="mb-9">
      <Text className="text-[15px] font-extrabold uppercase tracking-wide text-bloodline-600 mb-1">
        Step {step}
      </Text>
      <Text className="text-[22px] font-extrabold text-ink mb-2">{title}</Text>
      <Text className="text-[18px] leading-[27px] text-gray-800 mb-4">{body}</Text>
      <Image
        accessibilityLabel={imageAlt}
        source={image}
        resizeMode="cover"
        className="w-full rounded-2xl border border-gray-200 bg-paper overflow-hidden"
        style={{ width: '100%', aspectRatio: 390 / 844 }}
      />
    </View>
  );
}
