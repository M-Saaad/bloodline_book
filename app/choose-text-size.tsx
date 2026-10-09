import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { BrandMark } from '@/components/BrandMark';
import { TextSizeOptionsList, TextSizePreviewSample } from '@/components/TextSizeOptionsList';
import { Button } from '@/components/ui/Button';
import { FormKeyboardScreen } from '@/components/ui/FormKeyboardScreen';
import { Text } from '@/components/ui/Text';
import { useTextSizeStore } from '@/lib/store/text-size';
import { DEFAULT_TEXT_SIZE, type TextSizeKey } from '@/lib/ui/text-scale';

/**
 * One-time welcome step before sign-in. Farmers pick a comfortable text size;
 * the choice is saved on this device only.
 */
export default function ChooseTextSizeScreen() {
  const hydrated = useTextSizeStore((state) => state.hydrated);
  const onboardingCompleted = useTextSizeStore((state) => state.onboardingCompleted);
  const setSize = useTextSizeStore((state) => state.setSize);
  const completeOnboarding = useTextSizeStore((state) => state.completeOnboarding);
  const [selected, setSelected] = useState<TextSizeKey>(DEFAULT_TEXT_SIZE);
  const [continuing, setContinuing] = useState(false);

  function handleSelect(key: TextSizeKey) {
    setSelected(key);
    setSize(key);
  }

  if (hydrated && onboardingCompleted) {
    return <Redirect href="/" />;
  }

  async function handleContinue() {
    setContinuing(true);
    setSize(selected);
    await completeOnboarding();
    router.replace('/');
  }

  return (
    <FormKeyboardScreen contentContainerClassName="px-5 pt-12 pb-10">
      <View className="mb-5">
        <BrandMark size={52} />
      </View>
      <Text className="text-[30px] leading-[34px] font-extrabold text-bloodline-900 mb-2">
        Choose your text size
      </Text>
      <Text className="text-[17px] leading-6 text-gray-600 mb-6">
        Pick what is easiest to read outdoors and in the barn. You can change
        this later in More → Settings.
      </Text>
      <TextSizeOptionsList selected={selected} onSelect={handleSelect} />
      <TextSizePreviewSample />
      <View className="mt-8">
        <Button
          title="Continue"
          onPress={() => void handleContinue()}
          disabled={continuing}
        />
      </View>
    </FormKeyboardScreen>
  );
}
