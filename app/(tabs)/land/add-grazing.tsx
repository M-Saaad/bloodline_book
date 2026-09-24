import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { AnimalMultiSelectField } from '@/components/ui/AnimalMultiSelectField';
import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { todayIso } from '@/lib/dates';
import { mapAnimal, mapPasture } from '@/lib/db/mappers';
import { moveAnimalsToPasture } from '@/lib/db/land';
import { useFarm } from '@/providers/FarmProvider';

export default function AddGrazingScreen() {
  const { pastureId: pastureIdParam } = useLocalSearchParams<{
    pastureId?: string;
  }>();
  const { activeFarm } = useFarm();
  const [pastureId, setPastureId] = useState<string | null>(
    pastureIdParam ?? null,
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(todayIso);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { data: pastureRows } = useQuery(
    activeFarm
      ? `SELECT * FROM pastures
         WHERE farm_id = ?
         ORDER BY name COLLATE NOCASE`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const { data: animalRows } = useQuery(
    activeFarm
      ? `SELECT * FROM animals
         WHERE farm_id = ? AND status = 'active'
         ORDER BY COALESCE(name, tag_number, id)`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const pastures = useMemo(
    () => (pastureRows ?? []).map((row) => mapPasture(row as Record<string, unknown>)),
    [pastureRows],
  );
  const animals = useMemo(
    () => (animalRows ?? []).map((row) => mapAnimal(row as Record<string, unknown>)),
    [animalRows],
  );

  async function handleSave() {
    if (!activeFarm) {
      return;
    }

    setErrorMessage('');
    if (!pastureId) {
      setErrorMessage('Select a pasture.');
      return;
    }
    if (selectedIds.length === 0) {
      setErrorMessage('Select at least one animal.');
      return;
    }

    setLoading(true);
    try {
      await moveAnimalsToPasture(activeFarm.id, {
        pastureId,
        animalIds: selectedIds,
        startDate,
        notes: notes.trim() || undefined,
      });
      router.back();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not move animals.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (!activeFarm) {
    return null;
  }

  return (
    <HandWriteBlocked>
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="p-4">
      <FormMessage message={errorMessage} tone="error" />

      <Text className="text-sm font-medium text-gray-700 mb-2">Pasture</Text>
      {pastures.length === 0 ? (
        <Text className="text-sm text-gray-500 mb-4">
          Add a pasture before moving animals.
        </Text>
      ) : (
        <View className="gap-2 mb-4">
          {pastures.map((pasture) => {
            const selected = pastureId === pasture.id;
            return (
              <Button
                key={pasture.id}
                title={pasture.name}
                variant={selected ? 'primary' : 'outline'}
                onPress={() => setPastureId(pasture.id)}
              />
            );
          })}
        </View>
      )}

      <DateField
        label="Moved in"
        value={startDate}
        onChange={setStartDate}
        maximumDate={new Date()}
      />

      <AnimalMultiSelectField
        label="Animals"
        animals={animals}
        selectedIds={selectedIds}
        onChange={setSelectedIds}
      />

      <Input
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        placeholder="Optional"
      />

      <Button
        title={loading ? 'Saving…' : 'Move Animals'}
        onPress={handleSave}
        disabled={loading || pastures.length === 0}
      />
    </ScrollView>
    </HandWriteBlocked>
  );
}
