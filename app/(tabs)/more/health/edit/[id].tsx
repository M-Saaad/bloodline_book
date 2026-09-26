import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { DeleteRecordButton } from '@/components/DeleteRecordButton';
import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import {
  parseWithdrawalDays,
  TreatmentFields,
} from '@/components/health/TreatmentFields';
import { AnimalSelectField } from '@/components/ui/AnimalSelectField';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import { mapAnimal, mapHealthRecord } from '@/lib/db/mappers';
import {
  deleteHealthRecord,
  getHealthRecordById,
  updateHealthRecord,
} from '@/lib/db/health';
import {
  healthKindSupportsWithdrawal,
  rememberedProducts,
  showsMilkWithdrawal,
} from '@/lib/domain/health';
import type { HealthRecordKind, TreatmentRoute } from '@/lib/types/health';
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

export default function EditHealthRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeFarm } = useFarm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [animalId, setAnimalId] = useState<string | null>(null);
  const [recordDate, setRecordDate] = useState('');
  const [kind, setKind] = useState<HealthRecordKind>('vaccination');
  const [famachaScore, setFamachaScore] = useState<number | null>(null);
  const [productName, setProductName] = useState('');
  const [dosage, setDosage] = useState('');
  const [route, setRoute] = useState<TreatmentRoute | null>(null);
  const [lotNumber, setLotNumber] = useState('');
  const [meatDays, setMeatDays] = useState('');
  const [milkDays, setMilkDays] = useState('');
  const [notes, setNotes] = useState('');

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

  const { data: productRows } = useQuery(
    activeFarm
      ? `SELECT * FROM health_records
         WHERE farm_id = ? AND product_name IS NOT NULL AND product_name != ''
         ORDER BY date DESC`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const remembered = useMemo(
    () =>
      rememberedProducts(
        (productRows ?? []).map((row) => {
          const record = mapHealthRecord(row as Record<string, unknown>);
          return {
            productName: record.productName,
            dosage: record.dosage,
            route: record.route,
            meatDays: record.meatWithdrawalDays,
            milkDays: record.milkWithdrawalDays,
            legacyDays: record.withdrawalDays,
            date: record.date,
          };
        }),
      ),
    [productRows],
  );

  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const record = await getHealthRecordById(id);
        if (cancelled || !record) {
          setErrorMessage('Health record not found.');
          return;
        }
        setAnimalId(record.animalId);
        setRecordDate(record.date);
        setKind(record.kind);
        setFamachaScore(record.famachaScore);
        setProductName(record.productName ?? '');
        setDosage(record.dosage ?? '');
        setRoute(record.route);
        setLotNumber(record.lotNumber ?? '');
        const meat =
          record.meatWithdrawalDays ?? record.withdrawalDays;
        const milk = record.milkWithdrawalDays ?? record.withdrawalDays;
        setMeatDays(meat != null ? String(meat) : '');
        setMilkDays(milk != null ? String(milk) : '');
        setNotes(record.notes ?? '');
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Could not load record.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSave() {
    if (!activeFarm || !id) {
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

    const meat = parseWithdrawalDays(meatDays);
    const milk = parseWithdrawalDays(
      showsMilkWithdrawal(activeFarm.segment) ? milkDays : '',
    );
    if (!meat.ok || !milk.ok) {
      setErrorMessage('Enter a valid withdrawal period in days.');
      return;
    }

    const animal = animals.find((item) => item.id === animalId);
    const animalLabel = animal ? animalDisplayLabel(animal) : 'Animal';
    const supports = healthKindSupportsWithdrawal(kind);

    setSaving(true);
    try {
      await updateHealthRecord(id, activeFarm.id, {
        animalId,
        date: recordDate,
        kind,
        famachaScore: kind === 'famacha' ? (famachaScore ?? undefined) : undefined,
        productName: productName.trim() || undefined,
        dosage: dosage.trim() || undefined,
        route,
        lotNumber: lotNumber.trim() || null,
        meatWithdrawalDays: supports ? meat.value : null,
        milkWithdrawalDays: supports ? milk.value : null,
        notes: notes.trim() || undefined,
        animalLabel,
        famachaRecheckDays: activeFarm.famachaRecheckDays,
      });
      router.back();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not save changes.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!activeFarm || !id) {
    return null;
  }

  if (loading) {
    return <LoadingState message="Loading health record…" />;
  }

  return (
    <HandWriteBlocked>
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerClassName="p-4"
        keyboardShouldPersistTaps="handled">
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
              FAMACHA score
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
                  <Text className="font-semibold">{score}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <TreatmentFields
          segment={activeFarm.segment}
          showWithdrawal={healthKindSupportsWithdrawal(kind)}
          famachaScore={kind === 'famacha' ? famachaScore : null}
          productName={productName}
          onProductName={setProductName}
          dosage={dosage}
          onDosage={setDosage}
          route={route}
          onRoute={setRoute}
          lotNumber={lotNumber}
          onLotNumber={setLotNumber}
          meatDays={meatDays}
          onMeatDays={setMeatDays}
          milkDays={milkDays}
          onMilkDays={setMilkDays}
          remembered={remembered}
          onPickProduct={(product) => {
            setProductName(product.productName);
            setDosage(product.dosage ?? '');
            setRoute(product.route);
            setMeatDays(product.meatDays != null ? String(product.meatDays) : '');
            if (showsMilkWithdrawal(activeFarm.segment)) {
              setMilkDays(
                product.milkDays != null ? String(product.milkDays) : '',
              );
            }
          }}
        />
        <Input label="Notes" value={notes} onChangeText={setNotes} />

        <Button
          title={saving ? 'Saving…' : 'Save Changes'}
          onPress={handleSave}
          disabled={saving}
        />

        <DeleteRecordButton
          confirmTitle="Delete health record?"
          confirmMessage="Open follow-up tasks from this record will be removed. Completed tasks stay."
          onDelete={async () => {
            await deleteHealthRecord(id);
            router.back();
          }}
        />
      </ScrollView>
    </HandWriteBlocked>
  );
}
