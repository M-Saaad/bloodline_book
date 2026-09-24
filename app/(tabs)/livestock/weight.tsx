import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { DateField } from '@/components/ui/DateField';
import { Button } from '@/components/ui/Button';
import { todayIso } from '@/lib/dates';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormMessage } from '@/components/ui/FormMessage';
import { LoadingState } from '@/components/ui/LoadingState';
import { mapAnimal } from '@/lib/db/mappers';
import { createWeighSessionWithLogs } from '@/lib/db/weights';
import type { WeighSession } from '@/lib/types/weight';
import { useFarm } from '@/providers/FarmProvider';

const WEIGH_POINTS: { value: WeighSession['weighPoint']; label: string }[] = [
  { value: 'ad_hoc', label: 'Ad hoc' },
  { value: 'birth', label: 'Birth' },
  { value: '30_day', label: '30 day' },
  { value: '60_day', label: '60 day' },
  { value: '90_day', label: '90 day' },
  { value: 'weaning', label: 'Weaning' },
  { value: 'yearling', label: 'Yearling' },
];

export default function WeighDayScreen() {
  const { activeFarm } = useFarm();
  const [sessionDate, setSessionDate] = useState(todayIso);
  const [weighPoint, setWeighPoint] =
    useState<WeighSession['weighPoint']>('ad_hoc');
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const { data, isLoading } = useQuery(
    activeFarm
      ? `SELECT * FROM animals
         WHERE farm_id = ? AND status = 'active'
         ORDER BY COALESCE(name, tag_number, id)`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const animals = useMemo(
    () => (data ?? []).map((row) => mapAnimal(row as Record<string, unknown>)),
    [data],
  );

  function setWeight(animalId: string, value: string) {
    setWeights((prev) => ({ ...prev, [animalId]: value }));
    setErrorMessage('');
    setSuccessMessage('');
  }

  async function handleSubmit() {
    if (!activeFarm) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');

    const entries = animals
      .map((animal) => {
        const raw = weights[animal.id]?.trim();
        if (!raw) {
          return null;
        }
        const weightValue = Number.parseFloat(raw);
        if (Number.isNaN(weightValue) || weightValue <= 0) {
          return null;
        }
        return { animalId: animal.id, weightValue };
      })
      .filter((entry): entry is { animalId: string; weightValue: number } =>
        entry !== null,
      );

    if (entries.length === 0) {
      setErrorMessage('Enter at least one weight to save.');
      return;
    }

    setSubmitting(true);
    try {
      await createWeighSessionWithLogs(activeFarm.id, {
        date: sessionDate,
        weighPoint,
        weightUnit: activeFarm.weightUnit,
        entries,
      });
      setSuccessMessage(
        `Recorded ${entries.length} weight${entries.length === 1 ? '' : 's'} in one transaction.`,
      );
      setTimeout(() => router.back(), 1200);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not save weigh day.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!activeFarm) {
    return null;
  }

  if (isLoading) {
    return <LoadingState message="Loading animals…" />;
  }

  return (
    <HandWriteBlocked>
    <View className="flex-1 bg-gray-50">
      <View className="px-4 py-3 border-b border-gray-200 bg-white">
        <DateField
          label="Weigh date"
          value={sessionDate}
          onChange={setSessionDate}
          maximumDate={new Date()}
        />
        <Text className="text-sm text-gray-600 mb-2">
          Unit: {activeFarm.weightUnit}
        </Text>
        <Text className="text-sm font-medium text-gray-700 mb-2">
          Weigh point
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {WEIGH_POINTS.map((point) => (
            <Pressable
              key={point.value}
              onPress={() => setWeighPoint(point.value)}
              className={`rounded-full border px-3 py-1 ${
                weighPoint === point.value
                  ? 'border-bloodline-600 bg-bloodline-50'
                  : 'border-gray-300'
              }`}>
              <Text
                className={`text-sm ${
                  weighPoint === point.value
                    ? 'text-bloodline-700 font-medium'
                    : 'text-gray-600'
                }`}>
                {point.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="px-4 pt-3">
        <FormMessage message={errorMessage} tone="error" />
        <FormMessage message={successMessage} tone="success" />
      </View>

      <FlatList
        data={animals}
        keyExtractor={(item) => item.id}
        contentContainerClassName={
          animals.length === 0 ? 'flex-grow' : 'px-4 py-2 pb-24'
        }
        ListEmptyComponent={
          <EmptyState
            title="No animals to weigh"
            description="Add animals before running weigh day."
            actionLabel="Add Animal"
            onAction={() => router.push('/(tabs)/livestock/add')}
          />
        }
        renderItem={({ item }) => (
          <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
            <View className="flex-1 pr-3">
              <Text className="font-medium text-gray-900">
                {item.name ?? item.tagNumber ?? 'Unnamed'}
              </Text>
              <Text className="text-gray-500 text-sm capitalize">
                {item.sex}
              </Text>
            </View>
            <TextInput
              value={weights[item.id] ?? ''}
              onChangeText={(value) => setWeight(item.id, value)}
              keyboardType="decimal-pad"
              placeholder="0"
              className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-right bg-white text-gray-900"
              placeholderTextColor="#9ca3af"
            />
          </View>
        )}
      />

      <View className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
        <Button
          title={submitting ? 'Saving…' : 'Submit Weigh Day'}
          onPress={handleSubmit}
          disabled={submitting || animals.length === 0}
        />
      </View>
    </View>
    </HandWriteBlocked>
  );
}
