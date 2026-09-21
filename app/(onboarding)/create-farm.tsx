import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { createFarm } from '@/lib/db/farms';
import type { Farm } from '@/lib/types/tenancy';
import { useUiStore } from '@/lib/store/ui';
import { useFarm } from '@/providers/FarmProvider';

const SEGMENTS: { value: Farm['segment']; label: string }[] = [
  { value: 'dairy', label: 'Dairy' },
  { value: 'meat', label: 'Meat' },
  { value: 'both', label: 'Both' },
];

export default function CreateFarmScreen() {
  const { farms, isLoading: farmsLoading, refreshFarms } = useFarm();
  const setActiveFarmId = useUiStore((s) => s.setActiveFarmId);
  const [name, setName] = useState('');
  const [segment, setSegment] = useState<Farm['segment']>('meat');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!farmsLoading && farms.length > 0) {
      router.replace('/(tabs)/dashboard');
    }
  }, [farms, farmsLoading]);

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
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="px-6 py-8">
      <Text className="text-2xl font-bold text-bloodline-800 mb-2">
        Set up your farm
      </Text>
      <Text className="text-gray-600 mb-8">
        This creates your farm and makes you the owner via the on_farm_created
        trigger.
      </Text>

      <FormMessage message={errorMessage} tone="error" />

      <Input
        label="Farm name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Red Oak Goat Farm"
      />

      <Text className="text-sm font-medium text-gray-700 mb-2">Segment</Text>
      <View className="flex-row gap-2 mb-6">
        {SEGMENTS.map((option) => {
          const selected = segment === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setSegment(option.value)}
              className={`flex-1 rounded-xl border px-3 py-3 items-center ${
                selected
                  ? 'border-bloodline-600 bg-bloodline-50'
                  : 'border-gray-300 bg-white'
              }`}>
              <Text
                className={`font-medium ${
                  selected ? 'text-bloodline-700' : 'text-gray-700'
                }`}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Button
        title={loading ? 'Creating…' : 'Create Farm'}
        onPress={handleCreate}
        disabled={loading}
      />
    </ScrollView>
  );
}
