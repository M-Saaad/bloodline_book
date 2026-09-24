import { useEffect, useRef, useState } from 'react';
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
  const [gestationDays, setGestationDays] = useState(
    String(activeFarm?.gestationDays ?? 150),
  );
  const [weaningDays, setWeaningDays] = useState(
    activeFarm?.weaningDays != null ? String(activeFarm.weaningDays) : '',
  );
  const [famachaRecheckDays, setFamachaRecheckDays] = useState(
    String(activeFarm?.famachaRecheckDays ?? 14),
  );
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const hydratedFarmId = useRef<string | null>(null);

  useEffect(() => {
    if (!activeFarm || hydratedFarmId.current === activeFarm.id) {
      return;
    }
    hydratedFarmId.current = activeFarm.id;
    setName(activeFarm.name);
    setWeightUnit(activeFarm.weightUnit);
    setCurrency(activeFarm.currency);
    setGestationDays(String(activeFarm.gestationDays ?? 150));
    setWeaningDays(
      activeFarm.weaningDays != null ? String(activeFarm.weaningDays) : '',
    );
    setFamachaRecheckDays(String(activeFarm.famachaRecheckDays ?? 14));
  }, [activeFarm]);

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

    const gestation = Number.parseInt(gestationDays, 10);
    if (!Number.isFinite(gestation) || gestation <= 0) {
      setErrorMessage('Enter gestation days as a positive number.');
      return;
    }
    const recheck = Number.parseInt(famachaRecheckDays, 10);
    if (!Number.isFinite(recheck) || recheck <= 0) {
      setErrorMessage('Enter FAMACHA recheck days as a positive number.');
      return;
    }
    let weaning: number | null = null;
    if (weaningDays.trim()) {
      weaning = Number.parseInt(weaningDays, 10);
      if (!Number.isFinite(weaning) || weaning <= 0) {
        setErrorMessage('Enter weaning days as a positive number, or leave it blank to turn weaning reminders off.');
        return;
      }
    }

    setLoading(true);
    try {
      await updateFarmSettings(activeFarm.id, {
        name: name.trim(),
        weightUnit,
        currency: currency.trim().toUpperCase(),
        gestationDays: gestation,
        weaningDays: weaning,
        famachaRecheckDays: recheck,
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

      <Input
        label="Gestation (days)"
        value={gestationDays}
        onChangeText={setGestationDays}
        keyboardType="numeric"
      />
      <Input
        label="Wean at (days)"
        value={weaningDays}
        onChangeText={setWeaningDays}
        keyboardType="numeric"
        placeholder="Blank turns weaning reminders off"
      />
      <Input
        label="FAMACHA recheck (days)"
        value={famachaRecheckDays}
        onChangeText={setFamachaRecheckDays}
        keyboardType="numeric"
      />

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
