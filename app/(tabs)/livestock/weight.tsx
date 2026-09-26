import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { applyWeighKey, WeighKeypad } from '@/components/livestock/WeighKeypad';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormMessage } from '@/components/ui/FormMessage';
import { LoadingState } from '@/components/ui/LoadingState';
import { todayIso } from '@/lib/dates';
import { mapAnimal } from '@/lib/db/mappers';
import { startOrAppendWeighSession } from '@/lib/db/weights';
import { animalMatchesSearch, formatLivestockRowTitle } from '@/lib/domain/animals';
import {
  isKnownWeighPoint,
  loadWeighMemory,
  saveWeighMemory,
  type WeighGroup,
} from '@/lib/storage/barn-memory';
import { herdRowSubtitle } from '@/lib/ui/animal-picker';
import type { Animal } from '@/lib/types/animals';
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

type WeighMode = 'chute' | 'list';

export default function WeighDayScreen() {
  const { animalId: focusAnimalId } = useLocalSearchParams<{ animalId?: string }>();
  const { activeFarm } = useFarm();
  const [sessionDate, setSessionDate] = useState(todayIso);
  const [weighPoint, setWeighPoint] =
    useState<WeighSession['weighPoint']>('ad_hoc');
  const [markWeaned, setMarkWeaned] = useState(false);
  const [group, setGroup] = useState<WeighGroup>({ kind: 'herd' });
  const [mode, setMode] = useState<WeighMode>('chute');
  const [listQuery, setListQuery] = useState('');
  const [setupOpen, setSetupOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [entry, setEntry] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, number>>({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [savedOnPhone, setSavedOnPhone] = useState(false);
  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { data, isLoading } = useQuery(
    activeFarm
      ? `SELECT * FROM animals
         WHERE farm_id = ? AND status = 'active'
         ORDER BY COALESCE(name, tag_number, id)`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const { data: pastureRows } = useQuery(
    activeFarm
      ? `SELECT id, name FROM pastures WHERE farm_id = ? ORDER BY name COLLATE NOCASE`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const { data: grazingRows } = useQuery(
    activeFarm
      ? `SELECT animal_id, pasture_id FROM grazing_records
         WHERE farm_id = ? AND end_date IS NULL`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const { data: weightRows } = useQuery(
    activeFarm
      ? `SELECT wl.animal_id, wl.weight_value, wl.weight_unit, ws.date
         FROM weight_logs wl
         JOIN weigh_sessions ws ON ws.id = wl.weigh_session_id
         WHERE wl.farm_id = ?
         ORDER BY ws.date DESC, wl.created_at DESC`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const animals = useMemo(
    () => (data ?? []).map((row) => mapAnimal(row as Record<string, unknown>)),
    [data],
  );
  const pastures = useMemo(
    () =>
      (pastureRows ?? []).map((row) => {
        const record = row as { id: string; name: string };
        return { id: String(record.id), name: String(record.name) };
      }),
    [pastureRows],
  );
  const pastureByAnimal = useMemo(() => {
    const map: Record<string, string> = {};
    for (const row of grazingRows ?? []) {
      const record = row as { animal_id: string; pasture_id: string };
      map[String(record.animal_id)] = String(record.pasture_id);
    }
    return map;
  }, [grazingRows]);
  const lastWeightByAnimal = useMemo(() => {
    const map = new Map<string, { value: number; unit: string; date: string }>();
    for (const row of weightRows ?? []) {
      const record = row as {
        animal_id: string;
        weight_value: number;
        weight_unit: string;
        date: string;
      };
      const animalId = String(record.animal_id);
      if (!map.has(animalId)) {
        map.set(animalId, {
          value: Number(record.weight_value),
          unit: String(record.weight_unit),
          date: String(record.date),
        });
      }
    }
    return map;
  }, [weightRows]);

  const queue = useMemo(() => {
    const matched = animals.filter((animal) =>
      animalInGroup(animal, group, pastureByAnimal),
    );
    if (!focusAnimalId) {
      return matched;
    }
    const focus = animals.find((animal) => animal.id === focusAnimalId);
    if (!focus) {
      return matched;
    }
    return [focus, ...matched.filter((animal) => animal.id !== focus.id)];
  }, [animals, focusAnimalId, group, pastureByAnimal]);

  useEffect(() => {
    if (!activeFarm) {
      return;
    }
    let cancelled = false;
    loadWeighMemory(activeFarm.id).then((memory) => {
      if (cancelled || !memory || !isKnownWeighPoint(memory.weighPoint)) {
        return;
      }
      setWeighPoint(memory.weighPoint);
      setGroup(memory.group);
      setMarkWeaned(memory.markWeaned);
    });
    return () => {
      cancelled = true;
    };
  }, [activeFarm]);

  useEffect(() => {
    const animal = queue[index];
    if (!animal) {
      return;
    }
    const existing = saved[animal.id];
    setEntry(existing != null ? String(existing) : '');
  }, [index, queue, saved]);

  async function rememberSetup(
    nextPoint: WeighSession['weighPoint'],
    nextGroup: WeighGroup,
    nextMarkWeaned: boolean,
  ) {
    if (!activeFarm) {
      return;
    }
    await saveWeighMemory(activeFarm.id, {
      weighPoint: nextPoint,
      group: nextGroup,
      markWeaned: nextMarkWeaned,
    });
  }

  async function persistEntries(
    entries: { animalId: string; weightValue: number }[],
  ) {
    if (!activeFarm || entries.length === 0) {
      return;
    }
    const nextSessionId = await startOrAppendWeighSession(activeFarm.id, {
      sessionId,
      date: sessionDate,
      weighPoint,
      weightUnit: activeFarm.weightUnit,
      entries,
      markWeaned: weighPoint === 'weaning' && markWeaned,
    });
    setSessionId(nextSessionId);
    setSaved((current) => {
      const next = { ...current };
      for (const item of entries) {
        next[item.animalId] = item.weightValue;
      }
      return next;
    });
    setSavedOnPhone(true);
  }

  async function saveAndNext() {
    const animal = queue[index];
    if (!animal) {
      return;
    }
    const weightValue = Number.parseFloat(entry);
    if (!Number.isFinite(weightValue) || weightValue <= 0) {
      setErrorMessage('Enter a weight greater than zero.');
      return;
    }
    setSubmitting(true);
    setErrorMessage('');
    try {
      await persistEntries([{ animalId: animal.id, weightValue }]);
      if (index >= queue.length - 1) {
        setFinished(true);
      } else {
        setIndex((current) => current + 1);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not save weight.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function skip() {
    setErrorMessage('');
    if (index >= queue.length - 1) {
      if (Object.keys(saved).length > 0) {
        setFinished(true);
      }
      return;
    }
    setIndex((current) => current + 1);
  }

  async function saveList() {
    const entries = queue
      .map((animal) => {
        const raw = (drafts[animal.id] ?? '').trim();
        if (!raw) {
          return null;
        }
        const weightValue = Number.parseFloat(raw);
        if (!Number.isFinite(weightValue) || weightValue <= 0) {
          return null;
        }
        if (saved[animal.id] === weightValue) {
          return null;
        }
        return { animalId: animal.id, weightValue };
      })
      .filter((item): item is { animalId: string; weightValue: number } => item != null);

    if (entries.length === 0) {
      setErrorMessage('Enter at least one weight to save.');
      return;
    }
    setSubmitting(true);
    setErrorMessage('');
    try {
      await persistEntries(entries);
      setDrafts({});
      setFinished(true);
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

  if (animals.length === 0) {
    return (
      <HandWriteBlocked>
        <EmptyState
          title="No animals to weigh"
          description="Add animals before running weigh day."
          actionLabel="Add Animal"
          onAction={() => router.push('/(tabs)/livestock/add')}
        />
      </HandWriteBlocked>
    );
  }

  if (finished) {
    const count = Object.keys(saved).length;
    return (
      <HandWriteBlocked>
        <View className="flex-1 bg-gray-50 p-4 justify-center">
          <Text className="text-2xl font-bold text-gray-900">
            Saved on this phone.
          </Text>
          <Text className="text-lg text-gray-800 mt-3">
            It will sync when you have a signal.
          </Text>
          <Text className="text-gray-700 mt-3">
            {count} weight{count === 1 ? '' : 's'} recorded.
          </Text>
          <View className="mt-6">
            <Button title="Done" onPress={() => router.back()} />
          </View>
        </View>
      </HandWriteBlocked>
    );
  }

  const listAnimals = queue.filter((animal) =>
    animalMatchesSearch(animal, listQuery),
  );
  const current = queue[index];
  const last = current ? lastWeightByAnimal.get(current.id) : undefined;
  const groupLabel = weighGroupLabel(group, pastures);
  const pointLabel =
    WEIGH_POINTS.find((point) => point.value === weighPoint)?.label ?? weighPoint;

  return (
    <HandWriteBlocked>
      <View className="flex-1 bg-gray-50">
        <View className="px-4 py-3 border-b border-gray-200 bg-white">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-gray-900 flex-1" numberOfLines={1}>
              {sessionDate} · {activeFarm.weightUnit} · {pointLabel}
            </Text>
            <Pressable
              onPress={() => setSetupOpen(true)}
              className="min-h-[44px] justify-center px-2">
              <Text className="text-bloodline-700 font-semibold">Edit</Text>
            </Pressable>
          </View>
          <Text className="text-gray-800 mt-1">
            {groupLabel}
            {queue.length > 0 ? ` · ${Math.min(index + 1, queue.length)} of ${queue.length}` : ''}
          </Text>
          <View className="flex-row gap-2 mt-3">
            <ModeButton
              label="One at a time"
              selected={mode === 'chute'}
              onPress={() => setMode('chute')}
            />
            <ModeButton
              label="List"
              selected={mode === 'list'}
              onPress={() => setMode('list')}
            />
          </View>
          {savedOnPhone ? (
            <Text className="text-gray-900 font-medium mt-3">
              Saved on this phone. Waiting for signal.
            </Text>
          ) : null}
          <FormMessage message={errorMessage} tone="error" />
        </View>

        {queue.length === 0 ? (
          <EmptyState
            title="No goats in this group"
            description="Choose a different pasture or the whole herd."
            actionLabel="Edit group"
            onAction={() => setSetupOpen(true)}
          />
        ) : mode === 'chute' && current ? (
          <View className="flex-1">
            <View className="px-4 py-4">
              <Text className="text-2xl font-bold text-gray-900" numberOfLines={1}>
                {formatLivestockRowTitle(current)}
              </Text>
              <Text className="text-gray-800 mt-1" numberOfLines={1}>
                {herdRowSubtitle(current)}
              </Text>
              <Text className="text-gray-800 mt-2">
                {last
                  ? `Last ${last.value} ${last.unit} on ${last.date}`
                  : 'No earlier weight'}
              </Text>
              <Text className="text-5xl font-bold text-gray-900 text-center mt-6">
                {entry || '0'}
              </Text>
              <Text className="text-center text-gray-700 mb-4">
                {activeFarm.weightUnit}
              </Text>
            </View>
            <WeighKeypad onKey={(key) => setEntry((value) => applyWeighKey(value, key))} />
            <View className="flex-row gap-2 p-4">
              <View className="flex-1">
                <Button title="Skip" variant="secondary" onPress={skip} />
              </View>
              <View className="flex-1">
                <Button
                  title={submitting ? 'Saving…' : 'Save + next'}
                  onPress={saveAndNext}
                  disabled={submitting}
                />
              </View>
            </View>
          </View>
        ) : (
          <View className="flex-1">
            <View className="px-4 pt-3">
              <TextInput
                value={listQuery}
                onChangeText={setListQuery}
                placeholder="Find a goat"
                autoCapitalize="none"
                autoCorrect={false}
                className="border border-gray-300 rounded-xl px-4 min-h-[48px] text-base bg-white text-gray-900"
                placeholderTextColor="#4b5563"
              />
            </View>
            <FlatList
              data={listAnimals}
              keyExtractor={(item) => item.id}
              contentContainerClassName="px-4 py-2 pb-28"
              ListEmptyComponent={
                <Text className="text-gray-800 py-6 text-center">
                  {listQuery.trim()
                    ? `No goat matches “${listQuery.trim()}”`
                    : 'No goats in this group'}
                </Text>
              }
              renderItem={({ item }) => (
                <View className="flex-row items-center py-3 border-b border-gray-200">
                  <View className="flex-1 pr-3">
                    <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
                      {formatLivestockRowTitle(item)}
                    </Text>
                    <Text className="text-gray-700 text-sm" numberOfLines={1}>
                      {saved[item.id] != null
                        ? `Saved ${saved[item.id]} ${activeFarm.weightUnit}`
                        : herdRowSubtitle(item)}
                    </Text>
                  </View>
                  <TextInput
                    value={drafts[item.id] ?? (saved[item.id] != null ? String(saved[item.id]) : '')}
                    onChangeText={(value) =>
                      setDrafts((currentDrafts) => ({
                        ...currentDrafts,
                        [item.id]: value,
                      }))
                    }
                    keyboardType="decimal-pad"
                    placeholder="0"
                    className="w-28 min-h-[48px] border border-gray-300 rounded-xl px-3 text-right text-xl bg-white text-gray-900"
                    placeholderTextColor="#4b5563"
                  />
                </View>
              )}
            />
            <View className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
              <Button
                title={submitting ? 'Saving…' : 'Save list'}
                onPress={saveList}
                disabled={submitting}
              />
            </View>
          </View>
        )}

        {setupOpen ? (
          <SetupSheet
            date={sessionDate}
            weighPoint={weighPoint}
            markWeaned={markWeaned}
            group={group}
            pastures={pastures}
            onClose={() => setSetupOpen(false)}
            onApply={(next) => {
              setSessionDate(next.date);
              setWeighPoint(next.weighPoint);
              setMarkWeaned(next.markWeaned);
              setGroup(next.group);
              setIndex(0);
              setSetupOpen(false);
              void rememberSetup(next.weighPoint, next.group, next.markWeaned);
            }}
          />
        ) : null}
      </View>
    </HandWriteBlocked>
  );
}

function animalInGroup(
  animal: Animal,
  group: WeighGroup,
  pastureByAnimal: Record<string, string>,
): boolean {
  switch (group.kind) {
    case 'herd':
      return true;
    case 'kids':
      return animal.lifecycleStage === 'kid';
    case 'pasture':
      return pastureByAnimal[animal.id] === group.pastureId;
    default: {
      const _exhaustive: never = group;
      return _exhaustive;
    }
  }
}

function weighGroupLabel(
  group: WeighGroup,
  pastures: { id: string; name: string }[],
): string {
  switch (group.kind) {
    case 'herd':
      return 'Whole herd';
    case 'kids':
      return 'Kids';
    case 'pasture':
      return pastures.find((pasture) => pasture.id === group.pastureId)?.name ?? 'Pasture';
    default: {
      const _exhaustive: never = group;
      return _exhaustive;
    }
  }
}

function ModeButton({
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
      onPress={onPress}
      className={`flex-1 min-h-[44px] rounded-xl items-center justify-center ${
        selected ? 'bg-bloodline-600' : 'bg-white border border-gray-300'
      }`}>
      <Text className={`font-semibold ${selected ? 'text-white' : 'text-gray-900'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function SetupSheet({
  date,
  weighPoint,
  markWeaned,
  group,
  pastures,
  onClose,
  onApply,
}: {
  date: string;
  weighPoint: WeighSession['weighPoint'];
  markWeaned: boolean;
  group: WeighGroup;
  pastures: { id: string; name: string }[];
  onClose: () => void;
  onApply: (next: {
    date: string;
    weighPoint: WeighSession['weighPoint'];
    markWeaned: boolean;
    group: WeighGroup;
  }) => void;
}) {
  const [draftDate, setDraftDate] = useState(date);
  const [draftPoint, setDraftPoint] = useState(weighPoint);
  const [draftWeaned, setDraftWeaned] = useState(markWeaned);
  const [draftGroup, setDraftGroup] = useState(group);

  return (
    <View className="absolute inset-0 bg-black/40 justify-end">
      <View className="bg-white rounded-t-3xl p-4 max-h-[85%]">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-lg font-semibold text-gray-900">Weigh setup</Text>
          <Pressable onPress={onClose} className="min-h-[44px] justify-center px-2">
            <Text className="text-bloodline-700 font-semibold">Close</Text>
          </Pressable>
        </View>
        <ScrollView className="max-h-[70%]">
        <DateField
          label="Weigh date"
          value={draftDate}
          onChange={setDraftDate}
          maximumDate={new Date()}
        />
        <Text className="text-sm font-semibold text-gray-900 mb-2">Weigh point</Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {WEIGH_POINTS.map((point) => (
            <Pressable
              key={point.value}
              onPress={() => setDraftPoint(point.value)}
              className={`min-h-[44px] justify-center rounded-full px-4 ${
                draftPoint === point.value
                  ? 'bg-bloodline-600'
                  : 'bg-white border border-gray-300'
              }`}>
              <Text
                className={`font-semibold ${
                  draftPoint === point.value ? 'text-white' : 'text-gray-900'
                }`}>
                {point.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {draftPoint === 'weaning' ? (
          <Pressable
            onPress={() => setDraftWeaned((value) => !value)}
            className="flex-row items-center min-h-[44px] mb-4">
            <View
              className={`w-6 h-6 rounded border mr-3 ${
                draftWeaned
                  ? 'bg-bloodline-600 border-bloodline-600'
                  : 'border-gray-500 bg-white'
              }`}
            />
            <Text className="text-gray-900">Also mark these kids as weaned</Text>
          </Pressable>
        ) : null}
        <Text className="text-sm font-semibold text-gray-900 mb-2">Group</Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          <Pressable
            onPress={() => setDraftGroup({ kind: 'herd' })}
            className={`min-h-[44px] justify-center rounded-full px-4 ${
              draftGroup.kind === 'herd'
                ? 'bg-bloodline-600'
                : 'bg-white border border-gray-300'
            }`}>
            <Text
              className={`font-semibold ${
                draftGroup.kind === 'herd' ? 'text-white' : 'text-gray-900'
              }`}>
              Whole herd
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setDraftGroup({ kind: 'kids' })}
            className={`min-h-[44px] justify-center rounded-full px-4 ${
              draftGroup.kind === 'kids'
                ? 'bg-bloodline-600'
                : 'bg-white border border-gray-300'
            }`}>
            <Text
              className={`font-semibold ${
                draftGroup.kind === 'kids' ? 'text-white' : 'text-gray-900'
              }`}>
              Kids
            </Text>
          </Pressable>
          {pastures.map((pasture) => {
            const selected =
              draftGroup.kind === 'pasture' && draftGroup.pastureId === pasture.id;
            return (
              <Pressable
                key={pasture.id}
                onPress={() =>
                  setDraftGroup({ kind: 'pasture', pastureId: pasture.id })
                }
                className={`min-h-[44px] justify-center rounded-full px-4 ${
                  selected ? 'bg-bloodline-600' : 'bg-white border border-gray-300'
                }`}>
                <Text className={`font-semibold ${selected ? 'text-white' : 'text-gray-900'}`}>
                  {pasture.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        </ScrollView>
        <Button
          title="Start"
          onPress={() =>
            onApply({
              date: draftDate,
              weighPoint: draftPoint,
              markWeaned: draftWeaned,
              group: draftGroup,
            })
          }
        />
      </View>
    </View>
  );
}
