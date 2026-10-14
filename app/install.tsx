import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';

import { IosShareButtonIcon } from '@/components/pilot/IosShareButtonIcon';
import { PilotPublicLayout } from '@/components/pilot/PilotPublicLayout';
import { PilotSection } from '@/components/pilot/PilotSection';
import { SUPPORT_EMAIL } from '@/lib/config/support';
import { Text } from '@/components/ui/Text';

const APP_URL = 'https://bloodline-book.vercel.app';

export default function InstallScreen() {
  return (
    <PilotPublicLayout
      title="Install Bloodline Book"
      intro="Pick the device you use most. You only need to do this once.">
      <PilotSection
        title="Computer"
        steps={[
          `Open ${APP_URL} in your browser.`,
          'Bookmark the page so you can find it again.',
        ]}
      />

      <PilotSection
        title="Android phone or tablet"
        steps={[
          'Open the same link in Chrome.',
          'Tap the menu (⋮) at the top right.',
          'Tap Add to Home screen or Install app.',
          'Open Bloodline Book from your home screen when you are ready to work.',
        ]}
      />

      <PilotSection
        title="iPhone"
        steps={[
          'Open the link in Safari (not Chrome).',
          'Tap Share at the bottom of the screen.',
          'Tap Add to Home Screen, then tap Add.',
          'Open Bloodline Book from your home screen before you sign in.',
        ]}
        footer={
          <View className="flex-row items-center gap-3 mt-1">
            <IosShareButtonIcon />
            <Text className="flex-1 text-[16px] leading-[23px] text-gray-600">
              The Share button looks like a square with an arrow pointing up.
            </Text>
          </View>
        }
      />

      <View className="rounded-2xl bg-bloodline-50 border border-bloodline-100 px-4 py-4 mb-6">
        <Text className="text-[17px] leading-[25px] text-gray-800">
          Prefer we set up your herd for you? Email your spreadsheet to{' '}
          <Text className="font-extrabold text-bloodline-700">{SUPPORT_EMAIL}</Text>
          .
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-x-2 gap-y-1 justify-center">
        <Text className="text-[17px] text-gray-600">Next: </Text>
        <Link href="/guide" asChild>
          <Pressable className="min-h-[44px] justify-center">
            <Text className="text-[17px] font-extrabold text-bloodline-600">
              Your first 10 goats →
            </Text>
          </Pressable>
        </Link>
      </View>
    </PilotPublicLayout>
  );
}
