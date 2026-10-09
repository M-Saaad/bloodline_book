import { Pressable, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useTextSizeStore } from '@/lib/store/text-size';
import { TEXT_SIZE_OPTIONS } from '@/lib/ui/text-scale';

/**
 * "Text size" choice for the whole app. Saved on this phone only: it applies
 * at once, works offline, and is not part of the farm's synced settings.
 */
export function TextSizeSetting() {
  const size = useTextSizeStore((state) => state.size);
  const setSize = useTextSizeStore((state) => state.setSize);

  return (
    <Card className="mb-5">
      <Text className="text-[19px] font-extrabold text-ink">Text size</Text>
      <Text className="text-base text-gray-500 mt-1 mb-3">
        Makes all text in the app bigger or smaller. This only changes this
        phone.
      </Text>
      <View className="gap-2">
        {TEXT_SIZE_OPTIONS.map((option) => {
          const on = option.key === size;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`Text size ${option.label}`}
              onPress={() => setSize(option.key)}
              className={`min-h-[52px] flex-row items-center rounded-2xl border px-4 py-2 ${
                on ? 'bg-bloodline-600 border-bloodline-600' : 'bg-white border-gray-300'
              }`}>
              <Text
                className={`text-[17px] ${on ? 'text-white font-extrabold' : 'text-ink font-bold'}`}>
                {option.label}
              </Text>
              {on ? (
                <Text className="ml-auto text-[17px] font-extrabold text-white">✓</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <Text className="text-[17px] leading-6 text-ink mt-4">
        Preview: Daisy is due to kid in 12 days. Meat withdrawal ends on May 3.
      </Text>
    </Card>
  );
}
