import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';

import { BrandMark } from '@/components/BrandMark';
import { IosShareButtonIcon } from '@/components/pilot/IosShareButtonIcon';
import { Button } from '@/components/ui/Button';
import { IOS_BROWSER_CONTINUE_KEY, shouldShowIosAddToHomeGate } from '@/lib/pilot/ios-web';
import { Text } from '@/components/ui/Text';

type IosAddToHomeScreenGateProps = {
  pathname: string;
  children: React.ReactNode;
};

export function IosAddToHomeScreenGate({
  pathname,
  children,
}: IosAddToHomeScreenGateProps) {
  const [continueInBrowser, setContinueInBrowser] = useState(false);
  const [hydrated, setHydrated] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }
    try {
      setContinueInBrowser(
        window.sessionStorage.getItem(IOS_BROWSER_CONTINUE_KEY) === '1',
      );
    } catch {
      setContinueInBrowser(false);
    }
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return null;
  }

  const showGate =
    Platform.OS === 'web' &&
    shouldShowIosAddToHomeGate(pathname, continueInBrowser);

  if (!showGate) {
    return <>{children}</>;
  }

  function handleContinueAnyway() {
    try {
      window.sessionStorage.setItem(IOS_BROWSER_CONTINUE_KEY, '1');
    } catch {
      // Session-only preference; still let them through this time.
    }
    setContinueInBrowser(true);
  }

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerClassName="px-5 pt-12 pb-10 max-w-lg w-full self-center">
      <BrandMark size={52} />
      <Text
        accessibilityRole="header"
        className="text-[30px] leading-[34px] font-extrabold text-bloodline-900 mt-5 mb-3">
        Add to Home Screen first
      </Text>
      <Text className="text-[18px] leading-[27px] text-gray-700 mb-6">
        On iPhone, Bloodline Book keeps your herd on this phone only when you
        open it from your home screen — not from a Safari tab.
      </Text>

      <View className="gap-4 mb-8">
        <View className="flex-row gap-3">
          <Text className="text-[18px] font-extrabold text-bloodline-600 w-7">
            1.
          </Text>
          <Text className="flex-1 text-[18px] leading-[27px] text-gray-800">
            Open this page in Safari (you are already there).
          </Text>
        </View>
        <View className="flex-row gap-3 items-start">
          <Text className="text-[18px] font-extrabold text-bloodline-600 w-7">
            2.
          </Text>
          <View className="flex-1 gap-2">
            <Text className="text-[18px] leading-[27px] text-gray-800">
              Tap <Text className="font-extrabold">Share</Text>, then{' '}
              <Text className="font-extrabold">Add to Home Screen</Text>.
            </Text>
            <IosShareButtonIcon />
          </View>
        </View>
        <View className="flex-row gap-3">
          <Text className="text-[18px] font-extrabold text-bloodline-600 w-7">
            3.
          </Text>
          <Text className="flex-1 text-[18px] leading-[27px] text-gray-800">
            Open <Text className="font-extrabold">Bloodline Book</Text> from your
            home screen, then sign in.
          </Text>
        </View>
      </View>

      <Button
        title="See full install steps"
        onPress={() => router.push('/install')}
        className="mb-4"
      />

      <Pressable
        onPress={handleContinueAnyway}
        accessibilityRole="button"
        className="min-h-[48px] items-center justify-center py-2">
        <Text className="text-base text-gray-500 underline">
          Continue in browser anyway
        </Text>
      </Pressable>
    </ScrollView>
  );
}
