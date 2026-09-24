import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { AnimalMultiSelectField } from '@/components/ui/AnimalMultiSelectField';
import { AnimalSelectField } from '@/components/ui/AnimalSelectField';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { formatDisplayDate, todayIso } from '@/lib/dates';
import { getAnimalById } from '@/lib/db/animals';
import {
  createBreedingEvent,
  createExposureBreedings,
  getOpenBreedingsForDam,
} from '@/lib/db/breeding';
import { mapAnimal } from '@/lib/db/mappers';
import {
  computeBreedingWindow,
  formatDueWindowPhrase,
} from '@/lib/domain/breeding';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';
import { confirmAction } from '@/lib/ui/confirm';
import { useFarm } from '@/providers/FarmProvider';

type BreedingMode = 'hand' | 'exposure';

export default function AddBreedingScreen() {
  const { activeFarm } = useFarm();
  const [mode, setMode] = useState<BreedingMode>('hand');
  const [damId, setDamId] = useState<string | null>(null);
  const [damIds, setDamIds] = useState<string[]>([]);
  const [sireId, setSireId] = useState<string | null>(null);
  const [sireExternalName, setSireExternalName] = useState('');
  const [bredDate, setBredDate] = useState(todayIso);
  const [exposureEnd, setExposureEnd] = useState(todayIso);
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

  const gestationDays = activeFarm?.gestationDays ?? 150;
  const window =
    mode === 'exposure'
      ? computeBreedingWindow({
          bredDate,
          exposureEndDate: exposureEnd,
          gestationDays,
        })
      : computeBreedingWindow({ bredDate, gestationDays });

  async function breedingsToClose(ids: string[]): Promise<string[] | null> {
    if (!activeFarm) {
      return null;
    }
    const toClose: string[] = [];
    const lines: string[] = [];
    for (const id of ids) {
      const open = await getOpenBreedingsForDam(activeFarm.id, id);
      if (open.length === 0) {
        continue;
      }
      const dam = females.find((animal) => animal.id === id);
      const loaded = dam ?? (await getAnimalById(id));
      const label = loaded ? animalDisplayLabel(loaded) : 'This doe';
      lines.push(
        `${label} is recorded as bred on ${formatDisplayDate(open[0].bredDate)}.`,
      );
      toClose.push(...open.map((event) => event.id));
    }
    if (toClose.length === 0) {
      return [];
    }
    const confirmed = await confirmAction(
      'Already bred',
      `${lines.join('\n')} Mark that breeding open?`,
      'Mark open',
    );
    return confirmed ? toClose : null;
  }

  async function handleSave() {
    if (!activeFarm) {
      return;
    }
    setErrorMessage('');
    if (!window) {
      setErrorMessage(
        mode === 'exposure'
          ? 'Exposure end date must be on or after the start date.'
          : 'Enter a valid bred date.',
      );
      return;
    }

    setLoading(true);
    try {
      if (mode === 'hand') {
        if (!damId) {
          setErrorMessage('Select a dam.');
          setLoading(false);
          return;
        }
        const closeIds = await breedingsToClose([damId]);
        if (closeIds == null) {
          setLoading(false);
          return;
        }
        const dam = females.find((animal) => animal.id === damId);
        await createBreedingEvent(activeFarm.id, {
          damId,
          sireId: sireId ?? undefined,
          sireExternalName: sireExternalName.trim() || undefined,
          bredDate,
          gestationDays,
          notes: notes.trim() || undefined,
          damLabel: dam ? animalDisplayLabel(dam) : 'Dam',
          closeBreedingIds: closeIds,
        });
      } else {
        if (damIds.length === 0) {
          setErrorMessage('Select at least one doe.');
          setLoading(false);
          return;
        }
        const closeIds = await breedingsToClose(damIds);
        if (closeIds == null) {
          setLoading(false);
          return;
        }
        const damLabels: Record<string, string> = {};
        for (const id of damIds) {
          const dam = females.find((animal) => animal.id === id);
          damLabels[id] = dam ? animalDisplayLabel(dam) : 'Dam';
        }
        await createExposureBreedings(activeFarm.id, {
          damIds,
          sireId: sireId ?? undefined,
          sireExternalName: sireExternalName.trim() || undefined,
          startDate: bredDate,
          endDate: exposureEnd,
          gestationDays,
          notes: notes.trim() || undefined,
          damLabels,
          closeBreedingIds: closeIds,
        });
      }
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
    <HandWriteBlocked>
      <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="p-4">
        <FormMessage message={errorMessage} tone="error" />

        <Text className="text-sm font-medium text-gray-700 mb-2">
          How was she bred?
        </Text>
        <View className="flex-row gap-2 mb-4">
          {(
            [
              { value: 'hand', label: 'Hand-bred / AI' },
              { value: 'exposure', label: 'Buck exposure' },
            ] as const
          ).map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setMode(option.value)}
              className={`flex-1 rounded-xl border px-3 py-3 ${
                mode === option.value
                  ? 'border-bloodline-600 bg-bloodline-50'
                  : 'border-gray-300 bg-white'
              }`}>
              <Text
                className={`text-center text-sm font-medium ${
                  mode === option.value ? 'text-bloodline-700' : 'text-gray-700'
                }`}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {mode === 'hand' ? (
          <AnimalSelectField
            label="Dam"
            animals={females}
            value={damId}
            onChange={setDamId}
            emptyMessage="Add active does on the Livestock tab first."
          />
        ) : (
          <AnimalMultiSelectField
            label="Does with the buck"
            animals={females}
            selectedIds={damIds}
            onChange={setDamIds}
            emptyMessage="Add active does on the Livestock tab first."
          />
        )}

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

        <DateField
          label={mode === 'exposure' ? 'Exposure start' : 'Bred date'}
          value={bredDate}
          onChange={setBredDate}
        />
        {mode === 'exposure' ? (
          <DateField
            label="Exposure end"
            value={exposureEnd}
            onChange={setExposureEnd}
          />
        ) : null}

        {window ? (
          <Text className="text-sm text-gray-600 mb-4">
            {formatDueWindowPhrase(window.windowStart, window.windowEnd)} (
            {gestationDays}-day gestation)
          </Text>
        ) : (
          <Text className="text-sm text-red-700 mb-4">
            Exposure end date must be on or after the start date.
          </Text>
        )}

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
    </HandWriteBlocked>
  );
}
