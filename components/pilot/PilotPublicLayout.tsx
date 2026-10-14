import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { BrandMark } from '@/components/BrandMark';
import { Text } from '@/components/ui/Text';

type PilotPublicLayoutProps = {
  title: string;
  intro?: string;
  children: ReactNode;
  backHref?: Href;
  backLabel?: string;
};

export function PilotPublicLayout({
  title,
  intro,
  children,
  backHref = '/(auth)/sign-in',
  backLabel = 'Back to sign in',
}: PilotPublicLayoutProps) {
  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerClassName="px-5 pt-10 pb-12 max-w-lg w-full self-center">
      <View className="mb-5">
        <BrandMark size={48} />
      </View>
      {backHref ? (
        <Link href={backHref} asChild>
          <Pressable className="min-h-[44px] justify-center mb-3 -ml-1">
            <Text className="text-base font-bold text-bloodline-600">
              ← {backLabel}
            </Text>
          </Pressable>
        </Link>
      ) : null}
      <Text
        accessibilityRole="header"
        className="text-[32px] leading-[36px] font-extrabold text-bloodline-900 mb-3">
        {title}
      </Text>
      {intro ? (
        <Text className="text-[18px] leading-[27px] text-gray-700 mb-6">
          {intro}
        </Text>
      ) : null}
      {children}
    </ScrollView>
  );
}
