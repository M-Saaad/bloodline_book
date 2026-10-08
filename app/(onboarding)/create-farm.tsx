import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { FormKeyboardScreen } from '@/components/ui/FormKeyboardScreen';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { Input } from '@/components/ui/Input';
import { Segmented } from '@/components/ui/Segmented';
import { createFarm } from '@/lib/db/farms';
import type { Farm } from '@/lib/types/tenancy';
import { useUiStore } from '@/lib/store/ui';
import { useFarm } from '@/providers/FarmProvider';

const SEGMENTS: { value: Farm['segment']; label: string }[] = [
  { value: 'dairy', label: 'Dairy' },
  { value: 'meat', label: 'Meat' },
  { value: 'both', label: 'Both' },
];

const WEIGHT_UNITS: Farm['weightUnit'][] = ['lb', 'kg'];

export default function CreateFarmScreen() {
  const setActiveFarmId = useUiStore((s) => s.setActiveFarmId);
  const { farms, activeFarm, isLoading: farmsLoading, refreshFarms } =
    useFarm();
  const [name, setName] = useState('');
  const [segment, setSegment] = useState<Farm['segment']>('meat');
  const [weightUnit, setWeightUnit] = useState<Farm['weightUnit']>('lb');
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useFocusEffect(
    useCallback(() => {
      void refreshFarms();
    }, [refreshFarms]),
  );

  useEffect(() => {
    if (!farmsLoading && (farms.length > 0 || activeFarm)) {
      router.replace('/(tabs)/dashboard');
    }
  }, [farms.length, activeFarm, farmsLoading]);

  if (farmsLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator size="large" color="#a52f1a" />
      </View>
    );
  }

  async function handleCreate() {
    setErrorMessage('');

    if (!name.trim()) {
      setErrorMessage('Enter a name for your operation.');
      return;
    }

    setLoading(true);
    try {
      const farmId = await createFarm({
        name: name.trim(),
        segment,
        weightUnit,
        currency: currency.trim().toUpperCase() || 'USD',
      });
      setActiveFarmId(farmId);
      await refreshFarms();
      router.replace('/(tabs)/dashboard');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not create farm.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <FormKeyboardScreen
      contentContainerClassName="px-5 pt-6 pb-8"
      footer={
        <Button
          title={loading ? 'Creating…' : 'Create farm'}
          onPress={handleCreate}
          disabled={loading}
          className="h-[60px]"
        />
      }>
      <View className="px-1 mb-5">
        <Text className="text-[15px] font-extrabold tracking-widest text-bloodline-600">
          STEP 1 OF 1
        </Text>
        <Text className="text-[32px] leading-[36px] font-extrabold text-ink mt-1.5">
          Set up your farm
        </Text>
        <Text className="text-[17px] leading-6 text-gray-500 mt-2">
          This creates your farm and makes you the owner.
        </Text>
      </View>

      <FormMessage message={errorMessage} tone="error" />

      <Input
        label="Farm name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Red Oak Goat Farm"
      />

      <View className="mb-5">
        <FieldLabel>What do you raise?</FieldLabel>
        <Segmented options={SEGMENTS} value={segment} onChange={setSegment} />
        <Text className="text-[15px] leading-5 text-gray-500 mt-1.5">
          This sets which breed list you see. You cannot change it later in
          Settings.
        </Text>
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Input
            label="Currency"
            value={currency}
            onChangeText={setCurrency}
            placeholder="USD"
            autoCapitalize="characters"
          />
        </View>
        <View className="flex-1">
          <FieldLabel>Weight unit</FieldLabel>
          <Segmented
            options={WEIGHT_UNITS.map((unit) => ({ value: unit, label: unit }))}
            value={weightUnit}
            onChange={setWeightUnit}
          />
        </View>
      </View>
    </FormKeyboardScreen>
  );
}
