import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

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
import { todayIso } from '@/lib/dates';
import { getAnimalById } from '@/lib/db/animals';
import { createDewormFollowUpTask, createHealthRecord } from '@/lib/db/health';
import { mapAnimal, mapHealthRecord } from '@/lib/db/mappers';
import {
  healthKindSupportsWithdrawal,
  needsFamachaFollowUp,
  rememberedProducts,
  showsMilkWithdrawal,
} from '@/lib/domain/health';
import type { HealthRecordKind, TreatmentRoute } from '@/lib/types/health';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';
import { confirmAction } from '@/lib/ui/confirm';
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
  const params = useLocalSearchParams<{
    animalId?: string;
    kind?: string;
    date?: string;
    product?: string;
    prefill?: string;
  }>();
  const { activeFarm } = useFarm();
  const [animalId, setAnimalId] = useState<string | null>(params.animalId ?? null);
  const [recordDate, setRecordDate] = useState(params.date || todayIso());
  const [kind, setKind] = useState<HealthRecordKind>(
    params.kind === 'deworming' ? 'deworming' : 'vaccination',
  );
  const [famachaScore, setFamachaScore] = useState<number | null>(null);
  const [productName, setProductName] = useState(params.product ?? '');
  const [dosage, setDosage] = useState('');
  const [route, setRoute] = useState<TreatmentRoute | null>(null);
  const [lotNumber, setLotNumber] = useState('');
  const [meatDays, setMeatDays] = useState('');
  const [milkDays, setMilkDays] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const appliedPrefill = useRef<string | null>(null);

  const { data: animalRows } = useQuery(
    activeFarm
      ? `SELECT * FROM animals
         WHERE farm_id = ? AND status = 'active'
         ORDER BY COALESCE(name, tag_number, id)`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const { data: productRows, isLoading: productsLoading } = useQuery(
    activeFarm
      ? `SELECT * FROM health_records
         WHERE farm_id = ? AND product_name IS NOT NULL AND product_name != ''
         ORDER BY date DESC`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const animals = useMemo(
    () => (animalRows ?? []).map((row) => mapAnimal(row as Record<string, unknown>)),
    [animalRows],
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
    if (!params.prefill || appliedPrefill.current === params.prefill) {
      return;
    }
    if (params.product && productsLoading) {
      return;
    }
    appliedPrefill.current = params.prefill;
    if (params.animalId) {
      setAnimalId(params.animalId);
    }
    if (params.kind === 'deworming') {
      setKind('deworming');
      setFamachaScore(null);
    }
    if (params.date) {
      setRecordDate(params.date);
    }
    if (params.product) {
      setProductName(params.product);
      const match = remembered.find(
        (product) =>
          product.productName.toLowerCase() === params.product?.toLowerCase(),
      );
      if (match) {
        setDosage(match.dosage ?? '');
        setRoute(match.route);
        setMeatDays(match.meatDays != null ? String(match.meatDays) : '');
        setMilkDays(match.milkDays != null ? String(match.milkDays) : '');
      }
    }
  }, [params, productsLoading, remembered]);

  function applyProduct(product: (typeof remembered)[number]) {
    setProductName(product.productName);
    setDosage(product.dosage ?? '');
    setRoute(product.route);
    setMeatDays(product.meatDays != null ? String(product.meatDays) : '');
    if (activeFarm && showsMilkWithdrawal(activeFarm.segment)) {
      setMilkDays(product.milkDays != null ? String(product.milkDays) : '');
    }
  }

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

    const meat = parseWithdrawalDays(meatDays);
    const milk = parseWithdrawalDays(
      showsMilkWithdrawal(activeFarm.segment) ? milkDays : '',
    );
    if (!meat.ok || !milk.ok) {
      setErrorMessage('Enter a valid withdrawal period in days.');
      return;
    }

    const animal =
      animals.find((item) => item.id === animalId) ??
      (await getAnimalById(animalId));
    const animalLabel = animal ? animalDisplayLabel(animal) : 'Animal';
    const supports = healthKindSupportsWithdrawal(kind);

    setLoading(true);
    try {
      const recordId = await createHealthRecord(activeFarm.id, {
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

      if (
        kind === 'famacha' &&
        famachaScore != null &&
        needsFamachaFollowUp(famachaScore)
      ) {
        const deworm = await confirmAction(
          'Deworm now?',
          `${animalLabel} scored FAMACHA ${famachaScore}. Deworm now opens a deworming record. Not now adds a deworm task due today.`,
          'Deworm now',
          'Not now',
        );
        if (deworm) {
          const last = (productRows ?? [])
            .map((row) => mapHealthRecord(row as Record<string, unknown>))
            .find((record) => record.kind === 'deworming' && record.productName);
          router.replace({
            pathname: '/(tabs)/more/health/add',
            params: {
              animalId,
              kind: 'deworming',
              date: todayIso(),
              product: last?.productName ?? '',
              prefill: String(Date.now()),
            },
          });
          return;
        }
        await createDewormFollowUpTask(activeFarm.id, {
          healthRecordId: recordId,
          animalLabel,
          famachaScore,
          dueDate: todayIso(),
        });
      }

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
      <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="p-4">
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
          onPickProduct={applyProduct}
        />
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
