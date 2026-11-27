import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { FormKeyboardScreen } from '@/components/ui/FormKeyboardScreen';
import { FormMessage } from '@/components/ui/FormMessage';
import { Text } from '@/components/ui/Text';
import { TextInput } from '@/components/ui/TextInput';
import { usePastTagValues } from '@/hooks/usePastTagValues';
import { addDaysToIso, formatDisplayDate, todayIso } from '@/lib/dates';
import { saveFastKidding, undoSavedFastKidding } from '@/lib/db/fast-kidding';
import { mapAnimal } from '@/lib/db/mappers';
import { animalMatchesSearch } from '@/lib/domain/animals';
import {
  doeMatchesKiddingSearch,
  FAST_KIDDING_UNDO_MS,
  fastKidConfirmationLine,
  prepareFastKidding,
  type FastKidDraft,
  type FastKiddingResult,
} from '@/lib/domain/fast-kidding';
import { pastTagSearchHint } from '@/lib/domain/tag-history';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';
import { useFarm } from '@/providers/FarmProvider';

function oneParam(value: string | string[] | undefined): string | null {
  return typeof value === 'string' && value ? value : null;
}

function emptyKid(birthOrder: number): FastKidDraft {
  return {
    sex: null,
    outcome: 'alive',
    color: '',
    birthWeight: '',
    tagNumber: '',
    birthOrder: String(birthOrder),
  };
}

function BigChoice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`flex-1 min-h-[64px] rounded-2xl items-center justify-center px-3 py-3 border-2 ${
        selected
          ? 'bg-bloodline-600 border-bloodline-600'
          : 'bg-white border-gray-300'
      }`}>
      <Text className={`text-xl font-extrabold ${selected ? 'text-white' : 'text-ink'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function AddKiddingScreen() {
  const params = useLocalSearchParams<{ damId?: string; breedingId?: string }>();
  const { activeFarm } = useFarm();
  const prefilledDamId = oneParam(params.damId);
  const breedingId = oneParam(params.breedingId);
  const [damId, setDamId] = useState<string | null>(prefilledDamId);
  const [query, setQuery] = useState('');
  const [kidDate, setKidDate] = useState(todayIso());
  const [kids, setKids] = useState<FastKidDraft[]>([emptyKid(1)]);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [saved, setSaved] = useState<FastKiddingResult | null>(null);
  const [undoOpen, setUndoOpen] = useState(false);

  useEffect(() => {
    if (prefilledDamId) {
      setDamId(prefilledDamId);
    }
  }, [prefilledDamId]);

  useEffect(() => {
    if (!saved || !undoOpen) {
      return;
    }
    const timer = setTimeout(() => setUndoOpen(false), FAST_KIDDING_UNDO_MS);
    return () => clearTimeout(timer);
  }, [saved, undoOpen]);

  const { data: animalRows, isLoading: animalsLoading } = useQuery(
    activeFarm
      ? `SELECT * FROM animals WHERE farm_id = ? AND status = 'active'`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );
  const { data: colorRows } = useQuery(
    activeFarm
      ? `SELECT DISTINCT color FROM animals
         WHERE farm_id = ? AND color IS NOT NULL AND trim(color) != ''
         ORDER BY color COLLATE NOCASE`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );
  const pastTags = usePastTagValues(activeFarm?.id);

  const herdDoes = useMemo(
    () =>
      (animalRows ?? [])
        .map((row) => mapAnimal(row as Record<string, unknown>))
        .filter(
          (animal) =>
            animal.farmId === activeFarm?.id && doeMatchesKiddingSearch(animal),
        ),
    [activeFarm?.id, animalRows],
  );
  const does = useMemo(() => {
    const normalized = query.trim();
    const matched = normalized
      ? herdDoes.filter((animal) =>
          animalMatchesSearch(animal, normalized, pastTags[animal.id] ?? []),
        )
      : herdDoes;
    return matched.sort((a, b) =>
      animalDisplayLabel(a).localeCompare(animalDisplayLabel(b), undefined, {
        sensitivity: 'base',
      }),
    );
  }, [herdDoes, pastTags, query]);

  const colors = useMemo(
    () =>
      (colorRows ?? [])
        .map((row) => String((row as { color?: string }).color ?? '').trim())
        .filter(Boolean),
    [colorRows],
  );

  const dam = herdDoes.find((animal) => animal.id === damId) ?? null;
  const damLabel = dam ? animalDisplayLabel(dam) : 'Doe';
  const yesterday = addDaysToIso(todayIso(), -1) ?? kidDate;

  function updateKid(index: number, patch: Partial<FastKidDraft>) {
    setKids((prev) => prev.map((kid, i) => (i === index ? { ...kid, ...patch } : kid)));
  }

  async function handleSave() {
    if (!activeFarm || saving || saved) {
      return;
    }
    if (!dam) {
      setErrorMessage('Choose a doe on this farm.');
      return;
    }
    setErrorMessage('');
    const prepared = prepareFastKidding({ damId: dam.id, kidDate, kids });
    if (!prepared.ok) {
      setErrorMessage(prepared.message);
      return;
    }
    setSaving(true);
    try {
      const result = await saveFastKidding(activeFarm.id, {
        damId: dam.id,
        kidDate,
        kids,
        breedingEventId: prefilledDamId === dam.id ? breedingId : null,
        weaningDays: activeFarm.weaningDays,
        weightUnit: activeFarm.weightUnit,
        damLabel,
      });
      setSaved(result);
      setUndoOpen(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not save kidding.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUndo() {
    if (!saved) {
      return;
    }
    setErrorMessage('');
    setSaving(true);
    try {
      await undoSavedFastKidding(saved.kiddingId);
      setSaved(null);
      setUndoOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not undo kidding.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <HandWriteBlocked>
      <FormKeyboardScreen
        contentContainerClassName="px-5 pt-2 pb-8"
        footer={
          saved ? (
            <View className="gap-2">
              {undoOpen ? (
                <Button
                  title="Undo"
                  variant="outline"
                  onPress={() => void handleUndo()}
                  disabled={saving}
                  className="min-h-[64px]"
                />
              ) : null}
              <Button
                title="Edit"
                onPress={() =>
                  router.push(`/(tabs)/more/breeding/edit-kidding/${saved.kiddingId}`)
                }
                className="min-h-[64px]"
              />
            </View>
          ) : (
            <Button
              title={saving ? 'Saving…' : 'Save kidding'}
              onPress={() => void handleSave()}
              disabled={saving || !dam}
              className="min-h-[64px]"
            />
          )
        }>
        <FormMessage message={errorMessage} tone="error" />

        {saved ? (
          <View className="mb-4 rounded-[22px] bg-[#ddf0e4] px-4 py-4">
            <Text className="text-xl font-extrabold text-ink">Saved</Text>
            <Text className="text-lg text-ink mt-1">{damLabel}</Text>
            {saved.kids.map((kid, index) => (
              <Text key={`${kid.birthOrder}-${index}`} className="text-lg text-ink mt-1">
                {fastKidConfirmationLine(kid)}
              </Text>
            ))}
            {undoOpen ? (
              <Text className="text-base text-gray-500 mt-2">Undo is available for a few seconds.</Text>
            ) : null}
          </View>
        ) : null}

        {dam && !saved ? (
          <View className="mb-4 rounded-[22px] border border-gray-200 bg-white px-4 py-3">
            <Text className="text-2xl font-extrabold text-ink">{damLabel}</Text>
            {!prefilledDamId ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setDamId(null)}
                className="min-h-[48px] justify-center">
                <Text className="text-lg font-bold text-bloodline-600">Change doe</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {!dam && !saved ? (
          <View className="mb-4">
            <Text className="text-xl font-extrabold text-ink mb-2">Which doe?</Text>
            {animalsLoading && prefilledDamId ? (
              <Text className="text-lg text-gray-500">Loading doe…</Text>
            ) : null}
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Name, tag, old tag, or scrapie ID"
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              placeholderTextColor="#8a7b75"
              className="min-h-[64px] rounded-[18px] border border-gray-300 bg-white px-4 py-3 text-xl text-ink"
            />
            <View className="mt-3">
              {does.length === 0 ? (
                <Text className="text-lg text-gray-500">No matching doe.</Text>
              ) : (
                does.map((animal) => {
                  const hint = pastTagSearchHint(
                    animal,
                    query,
                    pastTags[animal.id] ?? [],
                  );
                  return (
                    <Pressable
                      key={animal.id}
                      accessibilityRole="button"
                      onPress={() => setDamId(animal.id)}
                      className="min-h-[72px] justify-center border-b border-gray-100 py-2">
                      <Text className="text-xl font-extrabold text-ink">
                        {animalDisplayLabel(animal)}
                      </Text>
                      {hint ? (
                        <Text className="text-base text-gray-500">{hint}</Text>
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </View>
          </View>
        ) : null}

        {dam && !saved ? (
          <View>
            <Text className="text-xl font-extrabold text-ink mb-2">Date</Text>
            <View className="flex-row gap-2 mb-2">
              <Pressable
                accessibilityRole="button"
                onPress={() => setKidDate(todayIso())}
                className={`flex-1 min-h-[56px] rounded-2xl items-center justify-center border-2 ${
                  kidDate === todayIso()
                    ? 'bg-bloodline-600 border-bloodline-600'
                    : 'bg-white border-gray-300'
                }`}>
                <Text
                  className={`text-lg font-extrabold ${
                    kidDate === todayIso() ? 'text-white' : 'text-ink'
                  }`}>
                  Today
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setKidDate(yesterday)}
                className={`flex-1 min-h-[56px] rounded-2xl items-center justify-center border-2 ${
                  kidDate === yesterday
                    ? 'bg-bloodline-600 border-bloodline-600'
                    : 'bg-white border-gray-300'
                }`}>
                <Text
                  className={`text-lg font-extrabold ${
                    kidDate === yesterday ? 'text-white' : 'text-ink'
                  }`}>
                  Yesterday
                </Text>
              </Pressable>
            </View>
            <DateField label="Or pick a date" value={kidDate} onChange={setKidDate} />
            <Text className="text-base text-gray-500 -mt-2 mb-4">
              {formatDisplayDate(kidDate)}
            </Text>

            {kids.map((kid, index) => (
              <View
                key={`kid-${index}`}
                className="mb-4 rounded-[22px] border border-gray-200 bg-white px-4 py-4">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-xl font-extrabold text-ink">Kid</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setKids((prev) => prev.filter((_, i) => i !== index))}
                    className="min-h-[48px] justify-center px-2">
                    <Text className="text-lg font-bold text-bloodline-600">Remove</Text>
                  </Pressable>
                </View>

                <Text className="text-base font-bold text-ink mb-2">Sex</Text>
                <View className="flex-row gap-2 mb-3">
                  <BigChoice
                    label="Buck"
                    selected={kid.sex === 'male'}
                    onPress={() => updateKid(index, { sex: 'male' })}
                  />
                  <BigChoice
                    label="Doe"
                    selected={kid.sex === 'female'}
                    onPress={() => updateKid(index, { sex: 'female' })}
                  />
                </View>

                <Text className="text-base font-bold text-ink mb-2">Alive</Text>
                <View className="flex-row gap-2 mb-3">
                  <BigChoice
                    label="Alive"
                    selected={kid.outcome === 'alive'}
                    onPress={() => updateKid(index, { outcome: 'alive' })}
                  />
                  <BigChoice
                    label="Stillborn"
                    selected={kid.outcome === 'dead'}
                    onPress={() => updateKid(index, { outcome: 'dead' })}
                  />
                </View>

                <Text className="text-base font-bold text-ink mb-2">
                  Birth order
                </Text>
                <TextInput
                  value={kid.birthOrder}
                  onChangeText={(birthOrder) => updateKid(index, { birthOrder })}
                  keyboardType="number-pad"
                  className="min-h-[56px] rounded-[18px] border border-gray-300 bg-white px-4 py-3 text-xl text-ink mb-3"
                />

                <Text className="text-base font-bold text-ink mb-2">
                  Colour <Text className="font-medium text-gray-500">optional</Text>
                </Text>
                <TextInput
                  value={kid.color}
                  onChangeText={(color) => updateKid(index, { color })}
                  placeholder="Colour"
                  placeholderTextColor="#8a7b75"
                  autoCapitalize="words"
                  className="min-h-[56px] rounded-[18px] border border-gray-300 bg-white px-4 py-3 text-xl text-ink"
                />
                {colors.length > 0 ? (
                  <View className="flex-row flex-wrap gap-2 mt-2 mb-3">
                    {colors.map((color) => (
                      <Pressable
                        key={color}
                        accessibilityRole="button"
                        onPress={() => updateKid(index, { color })}
                        className="min-h-[48px] justify-center rounded-full border border-gray-300 bg-white px-4">
                        <Text className="text-lg font-semibold text-ink">{color}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <View className="h-3" />
                )}

                <Text className="text-base font-bold text-ink mb-2">
                  Birth weight ({activeFarm?.weightUnit ?? 'lb'}){' '}
                  <Text className="font-medium text-gray-500">optional</Text>
                </Text>
                <TextInput
                  value={kid.birthWeight}
                  onChangeText={(birthWeight) => updateKid(index, { birthWeight })}
                  keyboardType="decimal-pad"
                  placeholder="0.0"
                  placeholderTextColor="#8a7b75"
                  className="min-h-[56px] rounded-[18px] border border-gray-300 bg-white px-4 py-3 text-xl text-ink mb-3"
                />

                <Text className="text-base font-bold text-ink mb-2">
                  Farm tag <Text className="font-medium text-gray-500">optional</Text>
                </Text>
                <TextInput
                  value={kid.tagNumber}
                  onChangeText={(tagNumber) => updateKid(index, { tagNumber })}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="Tag later"
                  placeholderTextColor="#8a7b75"
                  className="min-h-[56px] rounded-[18px] border border-gray-300 bg-white px-4 py-3 text-xl text-ink"
                />
              </View>
            ))}

            <Button
              title="Add kid"
              variant="secondary"
              onPress={() =>
                setKids((prev) => {
                  const next =
                    prev.reduce((max, kid) => {
                      const order = Number.parseInt(kid.birthOrder, 10);
                      return Number.isFinite(order) ? Math.max(max, order) : max;
                    }, 0) + 1;
                  return [...prev, emptyKid(next)];
                })
              }
              className="min-h-[64px]"
            />
          </View>
        ) : null}
      </FormKeyboardScreen>
    </HandWriteBlocked>
  );
}
