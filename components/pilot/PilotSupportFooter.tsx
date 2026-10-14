import * as Linking from 'expo-linking';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import {
  SUPPORT_EMAIL,
  SUPPORT_WHATSAPP_URL,
} from '@/lib/config/support';
import { Text } from '@/components/ui/Text';

export function PilotSupportFooter({ lead }: { lead?: string }) {
  return (
    <View className="mt-2 pt-6 border-t border-gray-200 gap-3">
      {lead ? (
        <Text className="text-[18px] leading-[27px] text-gray-800">{lead}</Text>
      ) : null}
      <Button
        title="Message us on WhatsApp"
        onPress={() => {
          void Linking.openURL(SUPPORT_WHATSAPP_URL);
        }}
        className="h-[56px]"
      />
      <Pressable
        onPress={() => {
          void Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
        }}
        accessibilityRole="button"
        className="min-h-[52px] rounded-2xl border-2 border-bloodline-600 bg-white items-center justify-center px-4 py-3 active:bg-bloodline-50">
        <Text className="text-lg font-extrabold text-bloodline-600">
          {SUPPORT_EMAIL}
        </Text>
      </Pressable>
    </View>
  );
}
