import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { AnimalSelectField } from '@/components/ui/AnimalSelectField';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { todayIso } from '@/lib/dates';
import { mapAnimal } from '@/lib/db/mappers';
import { createHealthRecord } from '@/lib/db/health';
import { healthKindSupportsWithdrawal } from '@/lib/domain/health';
import type { HealthRecordKind } from '@/lib/types/health';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';
import { useFarm } from '@/providers/FarmProvider';

const HEALTH_KINDS: { value: HealthRecordKind; label: string }[] = [
  { value: 'vaccination', label: 'Vaccination' },
  { value: 'famacha', label: 'FAMACHA' },
  { value: 'deworming', label: 'Deworming' },
  { value: 'treatment', label: 'Treatment' },
  { value: 'injury', label: 'Injury' },
  { value: 'hoof_trim', label: 'Hoof trim' },
  { value: 'other', label: 'Other' },
];

const FAMACHA_SCORES = [1, 2, 3, 4, 5] as const;

export default function AddHealthRecordScreen() {
  const { activeFarm } = useFarm();
  const [animalId, setAnimalId] = useState<string | null>(null);
  const [recordDate, setRecordDate] = useState(todayIso);
  const [kind, setKind] = useState<HealthRecordKind>('vaccination');
  const [famachaScore, setFamachaScore] = useState<number | null>(null);
  const [productName, setProductName] = useState('');
  const [dosage, setDosage] = useState('');
  const [withdrawalDays, setWithdrawalDays] = useState('');
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

  async function handleSave() {
    if (!activeFarm) {
      return;
    }

    setErrorMessage('');
    if (!animalId) {
      setErrorMessage('Select an animal.');
      return;
    }

    if (kind === 'famacha' && famachaScore == null) {
      setErrorMessage('Pick a FAMACHA score.');
      return;
    }

    let parsedWithdrawal: number | undefined;
    if (withdrawalDays.trim() && healthKindSupportsWithdrawal(kind)) {
      parsedWithdrawal = Number.parseInt(withdrawalDays, 10);
      if (Number.isNaN(parsedWithdrawal) || parsedWithdrawal < 0) {
        setErrorMessage('Enter a valid withdrawal period in days.');
        return;
      }
    }

    const animal = animals.find((item) => item.id === animalId);
    const animalLabel = animal ? animalDisplayLabel(animal) : 'Animal';

    setLoading(true);
    try {
      await createHealthRecord(activeFarm.id, {
        animalId,
        date: recordDate,
        kind,
        famachaScore: kind === 'famacha' ? (famachaScore ?? undefined) : undefined,
        productName: productName.trim() || undefined,
        dosage: dosage.trim() || undefined,
        withdrawalDays: parsedWithdrawal,
        notes: notes.trim() || undefined,
        animalLabel,
      });
      router.back();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not save health record.',
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
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="p-4">
      <FormMessage message={errorMessage} tone="error" />

      <AnimalSelectField
        label="Animal"
        animals={animals}
        value={animalId}
        onChange={setAnimalId}
        emptyMessage="Add active animals on the Livestock tab first."
      />

      <DateField label="Date" value={recordDate} onChange={setRecordDate} />

      <Text className="text-sm font-medium text-gray-700 mb-2">Event type</Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {HEALTH_KINDS.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => {
              setKind(option.value);
              if (option.value !== 'famacha') {
                setFamachaScore(null);
              }
            }}
            className={`rounded-full border px-3 py-1.5 ${
              kind === option.value
                ? 'border-bloodline-600 bg-bloodline-50'
                : 'border-gray-300 bg-white'
            }`}>
            <Text
              className={`text-sm ${
                kind === option.value
                  ? 'text-bloodline-700 font-medium'
                  : 'text-gray-700'
              }`}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {kind === 'famacha' ? (
        <>
          <Text className="text-sm font-medium text-gray-700 mb-2">
            FAMACHA score (1 = healthy, 5 = anemic)
          </Text>
          <View className="flex-row gap-2 mb-4">
            {FAMACHA_SCORES.map((score) => (
              <Pressable
                key={score}
                onPress={() => setFamachaScore(score)}
                className={`flex-1 rounded-xl border py-3 items-center ${
                  famachaScore === score
                    ? 'border-bloodline-600 bg-bloodline-50'
                    : 'border-gray-300 bg-white'
                }`}>
                <Text
                  className={`font-semibold ${
                    famachaScore === score
                      ? 'text-bloodline-700'
                      : 'text-gray-700'
                  }`}>
                  {score}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <Input
        label="Product / medication"
        value={productName}
        onChangeText={setProductName}
        placeholder="Optional"
      />
      <Input
        label="Dosage"
        value={dosage}
        onChangeText={setDosage}
        placeholder="Optional"
      />
      {healthKindSupportsWithdrawal(kind) ? (
        <Input
          label="Withdrawal period (days)"
          value={withdrawalDays}
          onChangeText={setWithdrawalDays}
          keyboardType="numeric"
          placeholder="Optional — creates a follow-up task"
        />
      ) : null}
      <Input
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        placeholder="Optional"
      />

      <Button
        title={loading ? 'Saving…' : 'Save Health Record'}
        onPress={handleSave}
        disabled={loading}
      />
    </ScrollView>
    </HandWriteBlocked>
  );
}
