import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { PilotPublicLayout } from '@/components/pilot/PilotPublicLayout';
import {
  DATA_PAGE_PARAGRAPHS,
  DATA_PAGE_TITLE,
} from '@/lib/pilot/data-page-sections';
import { Text } from '@/components/ui/Text';

export default function DataScreen() {
  return (
    <PilotPublicLayout title={DATA_PAGE_TITLE}>
      <View className="gap-6 mb-8">
        {DATA_PAGE_PARAGRAPHS.map((paragraph, index) => (
          <Text
            key={index}
            className="text-[18px] leading-[27px] text-gray-800">
            {paragraph}
          </Text>
        ))}
      </View>

      <View className="flex-row flex-wrap gap-x-3 gap-y-1 justify-center">
        <Link href="/install" asChild>
          <Pressable className="min-h-[44px] justify-center">
            <Text className="text-[17px] font-extrabold text-bloodline-600">
              Install
            </Text>
          </Pressable>
        </Link>
        <Text className="text-[17px] text-gray-500">·</Text>
        <Link href="/guide" asChild>
          <Pressable className="min-h-[44px] justify-center">
            <Text className="text-[17px] font-extrabold text-bloodline-600">
              Your first 10 goats
            </Text>
          </Pressable>
        </Link>
      </View>
    </PilotPublicLayout>
  );
}
