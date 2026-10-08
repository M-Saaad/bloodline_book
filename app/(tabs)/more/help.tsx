import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, Text } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { databaseTarget } from '@/lib/config/database';
import {
  SUPPORT_EMAIL,
  SUPPORT_WHATSAPP_URL,
} from '@/lib/config/support';

const appVersion = Constants.expoConfig?.version ?? 'unknown';

async function openEmail() {
  await Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
}

async function openWhatsApp() {
  await Linking.openURL(SUPPORT_WHATSAPP_URL);
}

export default function HelpScreen() {
  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerClassName="px-5 pt-2 pb-10 gap-3.5">
      <Card className="px-[18px] py-4">
        <Text className="text-[19px] font-extrabold text-ink mb-1.5">
          Something wrong?
        </Text>
        <Text className="text-[17px] leading-[25px] text-ink">
          If the app says changes are not saved, take a screenshot and send it
          to us.
        </Text>
      </Card>

      <Button
        title="Message us on WhatsApp"
        onPress={() => {
          void openWhatsApp();
        }}
        className="h-[60px]"
      />
      <Pressable
        onPress={() => {
          void openEmail();
        }}
        accessibilityRole="button"
        className="min-h-[56px] rounded-2xl border-2 border-bloodline-600 bg-white items-center justify-center px-5 py-3 active:bg-bloodline-50">
        <Text className="text-lg font-extrabold text-bloodline-600">
          {SUPPORT_EMAIL}
        </Text>
      </Pressable>
      <Button
        title="See changes not saved"
        variant="secondary"
        onPress={() => router.push('/(tabs)/more/changes-not-saved')}
      />

      {Platform.OS === 'web' ? (
        <Card className="px-4 py-3.5">
          <Text className="text-base leading-[23px] text-gray-500">
            On iPhone, tap Share, then Add to Home Screen, and open the app from
            there. Wait for All saved before closing it.
          </Text>
        </Card>
      ) : null}

      <Text className="text-center text-sm text-gray-500">
        Version {appVersion} · {databaseTarget}
      </Text>
    </ScrollView>
  );
}
