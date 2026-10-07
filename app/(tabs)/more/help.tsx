import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

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
      className="flex-1 bg-gray-50"
      contentContainerClassName="p-4 gap-4">
      <Card>
        <Text className="text-base text-gray-700 mb-4">
          If the app says changes are not saved, take a screenshot and send it
          to us.
        </Text>

        <Text className="text-sm font-medium text-gray-700 mb-2">Email</Text>
        <Pressable
          onPress={() => {
            void openEmail();
          }}
          className="mb-4 py-2 active:opacity-70">
          <Text className="text-base text-bloodline-600 font-semibold">
            {SUPPORT_EMAIL}
          </Text>
        </Pressable>

        <Button
          title="Message us on WhatsApp"
          onPress={() => {
            void openWhatsApp();
          }}
        />

        <View className="mt-4 pt-4 border-t border-gray-200">
          <Button
            title="View changes not saved"
            variant="outline"
            onPress={() => router.push('/(tabs)/more/changes-not-saved')}
          />
        </View>
      </Card>

      <Text className="text-center text-xs text-gray-500">
        Version {appVersion} · {databaseTarget}
      </Text>
    </ScrollView>
  );
}
