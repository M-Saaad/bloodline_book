import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { AnimalMultiSelectField } from '@/components/ui/AnimalMultiSelectField';
import { Button } from '@/components/ui/Button';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { DateField } from '@/components/ui/DateField';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { FormKeyboardScreen } from '@/components/ui/FormKeyboardScreen';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { todayIso } from '@/lib/dates';
import { mapAnimal, mapPasture } from '@/lib/db/mappers';
import { moveAnimalsToPasture } from '@/lib/db/land';
import { useFarm } from '@/providers/FarmProvider';
import { Text } from '@/components/ui/Text';

export default function AddGrazingScreen() {
  const { pastureId: pastureIdParam, animalId: animalIdParam } =
    useLocalSearchParams<{
      pastureId?: string;
      animalId?: string;
    }>();
  const { activeFarm } = useFarm();
  const [pastureId, setPastureId] = useState<string | null>(
    pastureIdParam ?? null,
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(
    animalIdParam ? [animalIdParam] : [],
  );
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

  const { data: grazingRows } = useQuery(
    activeFarm
      ? `SELECT g.animal_id, g.pasture_id, p.name
         FROM grazing_records g
         JOIN pastures p ON p.id = g.pasture_id
         WHERE g.farm_id = ? AND g.end_date IS NULL`
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
  const openGrazing = useMemo(
    () =>
      (grazingRows ?? []).map((row) => {
        const record = row as {
          animal_id: string;
          pasture_id: string;
          name: string;
        };
        return {
          animalId: String(record.animal_id),
          pastureId: String(record.pasture_id),
          pastureName: String(record.name),
        };
      }),
    [grazingRows],
  );
  const pastureNameByAnimal = useMemo(() => {
    const names: Record<string, string> = {};
    for (const stay of openGrazing) {
      names[stay.animalId] = stay.pastureName;
    }
    return names;
  }, [openGrazing]);
  const alreadyHere = useMemo(
    () =>
      pastureId
        ? openGrazing
            .filter((stay) => stay.pastureId === pastureId)
            .map((stay) => ({
              id: stay.animalId,
              reason: 'Already on this pasture',
            }))
        : [],
    [openGrazing, pastureId],
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
      <FormKeyboardScreen
        contentContainerClassName="px-5 pt-2 pb-6"
        footer={
          <Button
            className="min-h-[60px]"
            title={
              loading
                ? 'Saving…'
                : selectedIds.length > 0
                  ? `Move ${selectedIds.length} goat${selectedIds.length === 1 ? '' : 's'}`
                  : 'Move goats'
            }
            onPress={handleSave}
            disabled={loading || pastures.length === 0}
          />
        }>
        <FormMessage message={errorMessage} tone="error" />

        <View className="mb-4">
          <FieldLabel>Move to</FieldLabel>
          {pastures.length === 0 ? (
            <Text className="text-[17px] text-gray-500">
              Add a pasture before moving animals.
            </Text>
          ) : (
            <ChipRow>
              {pastures.map((pasture) => (
                <Chip
                  key={pasture.id}
                  label={pasture.name}
                  selected={pastureId === pasture.id}
                  onPress={() => setPastureId(pasture.id)}
                />
              ))}
            </ChipRow>
          )}
        </View>

        <DateField
          label="Moved in"
          value={startDate}
          onChange={setStartDate}
          maximumDate={new Date()}
        />

        <AnimalMultiSelectField
          label="Pick goats"
          animals={animals}
          selectedIds={selectedIds}
          onChange={setSelectedIds}
          pastureByAnimalId={pastureNameByAnimal}
          disabled={alreadyHere}
          quickChips={pastures.map((pasture) => ({
            id: pasture.id,
            label: pasture.name,
            match: (animal) =>
              openGrazing.some(
                (stay) =>
                  stay.animalId === animal.id && stay.pastureId === pasture.id,
              ),
          }))}
          emptyMessage="Add active goats on the Livestock tab first."
        />

        <Input
          label="Notes"
          optional
          multiline
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional"
        />
      </FormKeyboardScreen>
    </HandWriteBlocked>
  );
}
