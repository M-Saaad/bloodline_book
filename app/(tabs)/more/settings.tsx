import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { FormKeyboardScreen } from '@/components/ui/FormKeyboardScreen';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Banner } from '@/components/ui/Banner';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { Input } from '@/components/ui/Input';
import { Segmented } from '@/components/ui/Segmented';
import { updateFarmSettings } from '@/lib/db/farms';
import type { Farm } from '@/lib/types/tenancy';
import { confirmAction } from '@/lib/ui/confirm';
import { formatFarmOperationType } from '@/lib/ui/farm-labels';
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

    if (weightUnit !== activeFarm.weightUnit) {
      const proceed = await confirmAction(
        'Change weight unit?',
        'Existing weights keep the unit they were entered in. Only new weights use the updated farm default.',
        'Change unit',
      );
      if (!proceed) {
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
    <FormKeyboardScreen
      contentContainerClassName="px-5 pt-2 pb-8"
      footer={
        <Button
          title={loading ? 'Saving…' : 'Save settings'}
          onPress={handleSave}
          disabled={loading}
          className="h-[60px]"
        />
      }>
      <FormMessage message={errorMessage} tone="error" />
      {successMessage ? (
        <View className="mb-4">
          <Banner
            tone="green"
            title="Settings saved"
            message="Your changes are on this phone and uploading."
          />
        </View>
      ) : null}

      <Input label="Farm name" value={name} onChangeText={setName} />

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

      <View className="flex-row gap-3 mt-4">
        <View className="flex-1">
          <Input
            label="Gestation (days)"
            value={gestationDays}
            onChangeText={setGestationDays}
            keyboardType="numeric"
          />
        </View>
        <View className="flex-1">
          <Input
            label="Wean at (days)"
            value={weaningDays}
            onChangeText={setWeaningDays}
            keyboardType="numeric"
            placeholder="Off"
            hint="Blank turns weaning reminders off"
          />
        </View>
      </View>
      <Input
        label="FAMACHA recheck (days)"
        value={famachaRecheckDays}
        onChangeText={setFamachaRecheckDays}
        keyboardType="numeric"
      />

      <Text className="text-base text-gray-500">
        Operation type:{' '}
        <Text className="font-bold text-ink">
          {formatFarmOperationType(activeFarm.segment)}
        </Text>{' '}
        (read-only)
      </Text>
    </FormKeyboardScreen>
  );
}
