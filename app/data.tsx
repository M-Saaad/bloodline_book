import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { PilotPublicLayout } from '@/components/pilot/PilotPublicLayout';
import { PilotSupportFooter } from '@/components/pilot/PilotSupportFooter';
import { PilotTextSection } from '@/components/pilot/PilotTextSection';
import {
  DATA_PAGE_INTRO,
  DATA_PAGE_SECTIONS,
} from '@/lib/pilot/data-page-sections';
import { Text } from '@/components/ui/Text';

export default function DataScreen() {
  return (
    <PilotPublicLayout title="Your data" intro={DATA_PAGE_INTRO}>
      {DATA_PAGE_SECTIONS.map((section) => (
        <PilotTextSection
          key={section.title}
          title={section.title}
          paragraphs={section.paragraphs}
        />
      ))}

      <PilotSupportFooter
        lead="Need an export or want your data removed? We respond by email."
      />

      <View className="mt-6 flex-row flex-wrap gap-x-3 gap-y-1 justify-center">
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
