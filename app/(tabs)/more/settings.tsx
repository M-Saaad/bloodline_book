import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { updateFarmSettings } from '@/lib/db/farms';
import type { Farm } from '@/lib/types/tenancy';
import { useFarm } from '@/providers/FarmProvider';

const WEIGHT_UNITS: Farm['weightUnit'][] = ['lb', 'kg'];

export default function SettingsScreen() {
  const { activeFarm, refreshFarms } = useFarm();
  const [name, setName] = useState(activeFarm?.name ?? '');
  const [weightUnit, setWeightUnit] = useState<Farm['weightUnit']>(
    activeFarm?.weightUnit ?? 'lb',
  );
  const [currency, setCurrency] = useState(activeFarm?.currency ?? 'USD');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  async function handleSave() {
    if (!activeFarm) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');

    if (!name.trim()) {
      setErrorMessage('Farm name is required.');
      return;
    }

    setLoading(true);
    try {
      await updateFarmSettings(activeFarm.id, {
        name: name.trim(),
        weightUnit,
        currency: currency.trim().toUpperCase(),
      });
      await refreshFarms();
      setSuccessMessage('Settings saved.');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not save settings.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (!activeFarm) {
    return null;
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="p-4">
      <FormMessage message={errorMessage} tone="error" />
      <FormMessage message={successMessage} tone="success" />

      <Input label="Farm name" value={name} onChangeText={setName} />
      <Input
        label="Currency"
        value={currency}
        onChangeText={setCurrency}
        placeholder="USD"
        autoCapitalize="characters"
      />

      <Text className="text-sm font-medium text-gray-700 mb-2">
        Weight unit
      </Text>
      <View className="flex-row gap-2 mb-6">
        {WEIGHT_UNITS.map((unit) => (
          <Pressable
            key={unit}
            onPress={() => setWeightUnit(unit)}
            className={`flex-1 rounded-xl border px-3 py-3 items-center ${
              weightUnit === unit
                ? 'border-bloodline-600 bg-bloodline-50'
                : 'border-gray-300 bg-white'
            }`}>
            <Text
              className={`font-medium ${
                weightUnit === unit ? 'text-bloodline-700' : 'text-gray-700'
              }`}>
              {unit}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text className="text-sm text-gray-500 mb-4 capitalize">
        Segment: {activeFarm.segment} (read-only)
      </Text>

      <Button
        title={loading ? 'Saving…' : 'Save Settings'}
        onPress={handleSave}
        disabled={loading}
      />
    </ScrollView>
  );
}
