import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { AnimalSelectField } from '@/components/ui/AnimalSelectField';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import {
  addDaysToIso,
  GOAT_GESTATION_DAYS,
  todayIso,
} from '@/lib/dates';
import { createBreedingEvent } from '@/lib/db/breeding';
import { mapAnimal } from '@/lib/db/mappers';
import { useFarm } from '@/providers/FarmProvider';

export default function AddBreedingScreen() {
  const { activeFarm } = useFarm();
  const [damId, setDamId] = useState<string | null>(null);
  const [sireId, setSireId] = useState<string | null>(null);
  const [sireExternalName, setSireExternalName] = useState('');
  const [bredDate, setBredDate] = useState(todayIso);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { data: animalRows } = useQuery(
    activeFarm
      ? `SELECT * FROM animals
         WHERE farm_id = ? AND status = 'active'
         ORDER BY COALESCE(name, tag_number, id)`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const animals = useMemo(
    () => (animalRows ?? []).map((row) => mapAnimal(row as Record<string, unknown>)),
    [animalRows],
  );

  const females = useMemo(
    () => animals.filter((animal) => animal.sex === 'female'),
    [animals],
  );

  const males = useMemo(
    () => animals.filter((animal) => animal.sex === 'male'),
    [animals],
  );

  const estimatedDue = addDaysToIso(bredDate, GOAT_GESTATION_DAYS);

  async function handleSave() {
    if (!activeFarm) {
      return;
    }

    setErrorMessage('');
    if (!damId) {
      setErrorMessage('Select a dam.');
      return;
    }

    setLoading(true);
    try {
      await createBreedingEvent(activeFarm.id, {
        damId,
        sireId: sireId ?? undefined,
        sireExternalName: sireExternalName.trim() || undefined,
        bredDate,
        notes: notes.trim() || undefined,
      });
      router.back();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not save breeding.',
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

      <AnimalSelectField
        label="Dam"
        animals={females}
        value={damId}
        onChange={setDamId}
        emptyMessage="Add active does on the Livestock tab first."
      />

      <AnimalSelectField
        label="Sire (on farm)"
        animals={males}
        value={sireId}
        onChange={setSireId}
        emptyMessage="Optional — use external sire name below if off-farm."
      />

      <Input
        label="External sire name"
        value={sireExternalName}
        onChangeText={setSireExternalName}
        placeholder="If sire is not in herd"
      />

      <DateField label="Bred date" value={bredDate} onChange={setBredDate} />

      {estimatedDue ? (
        <Text className="text-sm text-gray-600 mb-4">
          Estimated due date ({GOAT_GESTATION_DAYS}-day gestation): {estimatedDue}
        </Text>
      ) : null}

      <Input
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        placeholder="Optional"
      />

      <Button
        title={loading ? 'Saving…' : 'Save Breeding'}
        onPress={handleSave}
        disabled={loading}
      />
    </ScrollView>
  );
}
