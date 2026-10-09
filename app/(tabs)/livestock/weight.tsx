import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { applyWeighKey, WeighKeypad } from '@/components/livestock/WeighKeypad';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { Segmented } from '@/components/ui/Segmented';
import { DateField } from '@/components/ui/DateField';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormMessage } from '@/components/ui/FormMessage';
import { LoadingState } from '@/components/ui/LoadingState';
import { useLocalHerd } from '@/hooks/useLocalHerd';
import { formatDisplayDate, todayIso } from '@/lib/dates';
import { mapAnimal } from '@/lib/db/mappers';
import {
  preferLocalRows,
  shouldShowReplicaLoading,
} from '@/lib/domain/offline-replica';
import { startOrAppendWeighSession } from '@/lib/db/weights';
import { animalMatchesSearch } from '@/lib/domain/animals';
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
import { Text } from '@/components/ui/Text';
import { TextInput } from '@/components/ui/TextInput';

const WEIGH_POINTS: { value: WeighSession['weighPoint']; label: string }[] = [
  { value: 'ad_hoc', label: 'Any time' },
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
  const { activeFarm, hasSyncedBefore } = useFarm();
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
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const { data, isLoading } = useQuery(
    activeFarm
      ? `SELECT * FROM animals
         WHERE farm_id = ? AND status = 'active'
         ORDER BY COALESCE(name, tag_number, id)`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );
  const { animals: localHerd, resolved: localHerdResolved } = useLocalHerd(
    activeFarm?.id,
    'active',
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

  const queriedAnimals = useMemo(
    () => (data ?? []).map((row) => mapAnimal(row as Record<string, unknown>)),
    [data],
  );
  const animals = useMemo(
    () => preferLocalRows(queriedAnimals, localHerd),
    [queriedAnimals, localHerd],
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

  function listEntries() {
    return queue
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
  }

  async function saveList() {
    const entries = listEntries();

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

  const showAnimalLoading = shouldShowReplicaLoading({
    hasSynced: hasSyncedBefore,
    localRowCount: animals.length,
    localQueryLoading: isLoading && !localHerdResolved,
  });

  if (showAnimalLoading) {
    return <LoadingState message="Loading animals…" />;
  }

  const waitingCount = Object.keys(saved).length;
  if (animals.length === 0) {
    return (
      <HandWriteBlocked>
        <View className="flex-1 bg-paper">
          <WeighHeader
            topInset={insets.top}
            title="Weigh Day"
            waiting={0}
            onClose={() => router.back()}
          />
          <EmptyState
            title="No animals to weigh"
            description="Add animals before running weigh day."
            actionLabel="Add goat"
            onAction={() => router.push('/(tabs)/livestock/add')}
          />
        </View>
      </HandWriteBlocked>
    );
  }

  if (finished) {
    const count = Object.keys(saved).length;
    return (
      <HandWriteBlocked>
        <View className="flex-1 bg-paper">
          <View className="flex-1 items-center justify-center px-7">
            <View className="w-24 h-24 rounded-full bg-[#ddf0e4] items-center justify-center">
              <Text className="text-[48px] font-extrabold text-[#0f5a33]">✓</Text>
            </View>
            <Text className="text-[32px] leading-[36px] font-extrabold text-ink text-center mt-5 mb-1.5">
              Saved on this phone
            </Text>
            <Text className="text-lg leading-[26px] text-gray-500 text-center mb-5">
              {count} weight{count === 1 ? '' : 's'} recorded. They will upload when you have
              internet.
            </Text>
            <WaitingPill count={count} />
          </View>
          <View
            className="bg-white border-t border-gray-200 px-5 pt-3.5"
            style={{ paddingBottom: Math.max(insets.bottom, 14) }}>
            <Button title="Done" onPress={() => router.back()} className="min-h-[60px] rounded-[18px]" />
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
  const weighSubtitle = `${groupLabel} · ${queue.length} goat${queue.length === 1 ? '' : 's'}`;
  const pendingEntries = mode === 'list' ? listEntries() : [];
  const header = (
    <WeighHeader
      topInset={insets.top}
      title={mode === 'chute' ? 'Weigh-in' : 'Weigh Day'}
      subtitle={mode === 'list' ? weighSubtitle : undefined}
      waiting={savedOnPhone ? waitingCount : 0}
      onClose={() => router.back()}
    />
  );

  const entryNumber = Number.parseFloat(entry);
  const change =
    last && Number.isFinite(entryNumber) && entryNumber > 0 && last.unit === activeFarm.weightUnit
      ? Math.round((entryNumber - last.value) * 10) / 10
      : null;

  return (
    <HandWriteBlocked>
      <View className="flex-1 bg-paper">
        {header}
        <View className="px-5 pt-3 pb-3 gap-2.5">
          <Segmented
            options={[
              { value: 'chute' as WeighMode, label: 'One by one' },
              { value: 'list' as WeighMode, label: 'List' },
            ]}
            value={mode}
            onChange={setMode}
          />
          <View className="flex-row items-center justify-between">
            <Text className="flex-1 text-[15px] font-semibold text-gray-500" numberOfLines={1}>
              {formatDisplayDate(sessionDate)} · {activeFarm.weightUnit} · {pointLabel} · {groupLabel}
            </Text>
            <Pressable
              onPress={() => setSetupOpen(true)}
              accessibilityRole="button"
              className="min-h-[48px] justify-center pl-3">
              <Text className="text-base font-bold text-bloodline-600">Edit</Text>
            </Pressable>
          </View>
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
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-5 pb-8"
            keyboardShouldPersistTaps="handled">
            <View className="flex-row items-center gap-3 mb-4">
              <View className="flex-1 h-2.5 rounded-full bg-gray-200 overflow-hidden">
                <View
                  className="h-full rounded-full bg-bloodline-600"
                  style={{
                    width: `${Math.min(100, Math.round(((index + 1) / queue.length) * 100))}%`,
                  }}
                />
              </View>
              <Text className="text-[15px] font-bold text-gray-500">
                {Math.min(index + 1, queue.length)} of {queue.length}
              </Text>
            </View>
            <View className="bg-white border border-gray-200 rounded-[22px] px-5 py-[18px]">
              <View className="flex-row items-baseline justify-between">
                <Text className="flex-1 text-4xl leading-[40px] font-extrabold text-ink" numberOfLines={1}>
                  {current.name?.trim() || (current.tagNumber ? '' : 'Unnamed')}
                </Text>
                {current.tagNumber ? (
                  <Text className="text-[22px] font-extrabold text-bloodline-600">
                    #{current.tagNumber.trim()}
                  </Text>
                ) : null}
              </View>
              <Text className="text-base text-gray-500 mt-1">
                {herdRowSubtitle(current)}
                {' · '}
                {last
                  ? `Last weighed ${last.value} ${last.unit} on ${formatDisplayDate(last.date)}`
                  : 'No earlier weight'}
              </Text>
              <View className="flex-row items-end justify-between mt-3.5">
                <View className="flex-row items-baseline gap-2">
                  <Text className="text-[68px] leading-[72px] font-extrabold text-ink">
                    {entry || '0'}
                  </Text>
                  <Text className="text-2xl font-bold text-gray-500">{activeFarm.weightUnit}</Text>
                </View>
                {change != null ? (
                  <View className="mb-2">
                    <Badge
                      label={`${change > 0 ? '+' : ''}${change} ${activeFarm.weightUnit}`}
                      tone={change >= 0 ? 'success' : 'warning'}
                    />
                  </View>
                ) : null}
              </View>
            </View>
            <View className="mt-4">
              <WeighKeypad onKey={(key) => setEntry((value) => applyWeighKey(value, key))} />
            </View>
            <Button
              title={submitting ? 'Saving…' : 'Save and next goat ›'}
              onPress={saveAndNext}
              disabled={submitting}
              className="mt-4 min-h-[60px] rounded-[18px]"
            />
            <Pressable
              onPress={skip}
              accessibilityRole="button"
              className="min-h-[48px] items-center justify-center mt-1.5">
              <Text className="text-base font-bold text-gray-500">Skip this goat</Text>
            </Pressable>
          </ScrollView>
        ) : (
          <View className="flex-1">
            <View className="px-5 pb-3">
              <TextInput
                value={listQuery}
                onChangeText={setListQuery}
                placeholder="Find a goat"
                autoCapitalize="none"
                autoCorrect={false}
                className="h-14 border border-gray-300 rounded-[18px] px-4 text-lg bg-white text-ink"
                placeholderTextColor="#8a7b75"
              />
            </View>
            <FlatList
              data={listAnimals}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerClassName="px-5 pb-36"
              ListEmptyComponent={
                <Text className="text-base text-gray-500 py-6 text-center">
                  {listQuery.trim()
                    ? `No goat matches “${listQuery.trim()}”`
                    : 'No goats in this group'}
                </Text>
              }
              renderItem={({ item, index: rowIndex }) => {
                const isSaved = saved[item.id] != null;
                const lastWeight = lastWeightByAnimal.get(item.id);
                const focused = focusedId === item.id;
                const first = rowIndex === 0;
                const lastRow = rowIndex === listAnimals.length - 1;
                return (
                  <View
                    className={`bg-white border-x border-gray-200 ${
                      first ? 'border-t rounded-t-[22px]' : ''
                    } ${lastRow ? 'border-b rounded-b-[22px]' : ''}`}>
                    <View
                      className={`flex-row items-center gap-2.5 min-h-[72px] px-4 py-2 ${
                        lastRow ? '' : 'border-b border-gray-100'
                      }`}>
                      <View className="flex-1">
                        <Text className="text-lg font-extrabold text-ink" numberOfLines={1}>
                          {item.name?.trim() || (item.tagNumber ? '' : 'Unnamed')}
                          {item.tagNumber ? (
                            <Text className="text-bloodline-600">
                              {item.name?.trim() ? ' ' : ''}#{item.tagNumber.trim()}
                            </Text>
                          ) : null}
                        </Text>
                        <Text
                          className={`text-[15px] ${isSaved ? 'font-semibold text-[#0f5a33]' : 'text-gray-500'}`}
                          numberOfLines={1}>
                          {isSaved
                            ? `✓ Saved ${saved[item.id]} ${activeFarm.weightUnit}`
                            : lastWeight
                              ? `Last ${lastWeight.value} ${lastWeight.unit}`
                              : 'No earlier weight'}
                        </Text>
                      </View>
                      <View
                        className={`w-[116px] h-[52px] rounded-[14px] bg-white flex-row items-center px-3 ${
                          focused
                            ? 'border-[2.5px] border-bloodline-600'
                            : isSaved
                              ? 'border border-[#b7dcc4]'
                              : 'border border-gray-300'
                        }`}>
                        <TextInput
                          value={
                            drafts[item.id] ??
                            (saved[item.id] != null ? String(saved[item.id]) : '')
                          }
                          onChangeText={(value) =>
                            setDrafts((currentDrafts) => ({
                              ...currentDrafts,
                              [item.id]: value,
                            }))
                          }
                          onFocus={() => setFocusedId(item.id)}
                          onBlur={() => setFocusedId((id) => (id === item.id ? null : id))}
                          accessibilityLabel={`Weight for ${item.name?.trim() || item.tagNumber || 'goat'}`}
                          keyboardType="decimal-pad"
                          placeholder="0"
                          className="flex-1 text-right text-xl font-extrabold text-ink p-0"
                          placeholderTextColor="#8a7b75"
                        />
                        <Text className="text-sm font-semibold text-gray-500 ml-1">
                          {activeFarm.weightUnit}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
            <View
              className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-5 pt-3.5"
              style={{ paddingBottom: Math.max(insets.bottom, 14) }}>
              <Button
                title={
                  submitting
                    ? 'Saving…'
                    : pendingEntries.length > 0
                      ? `Save ${pendingEntries.length} weight${pendingEntries.length === 1 ? '' : 's'}`
                      : 'Save list'
                }
                onPress={saveList}
                disabled={submitting}
                className="min-h-[60px] rounded-[18px]"
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

function WaitingPill({ count }: { count: number }) {
  if (count <= 0) {
    return null;
  }
  return (
    <View className="flex-row items-center gap-1.5 h-9 px-3 rounded-full bg-[#fff1cc]">
      <Text className="text-sm font-bold text-[#6b3a00]">◔ {count} waiting</Text>
    </View>
  );
}

function WeighHeader({
  topInset,
  title,
  subtitle,
  waiting,
  onClose,
}: {
  topInset: number;
  title: string;
  subtitle?: string;
  waiting: number;
  onClose: () => void;
}) {
  return (
    <View
      className="flex-row items-center justify-between px-5 pb-2"
      style={{ paddingTop: Math.max(topInset, 8) + 12 }}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
        className="w-12 h-12 rounded-full bg-white border border-gray-200 items-center justify-center">
        <Text className="text-2xl text-ink">✕</Text>
      </Pressable>
      <View className="items-center flex-1 px-2">
        <Text className="text-[22px] font-extrabold text-ink">{title}</Text>
        {subtitle ? (
          <Text className="text-sm font-semibold text-gray-500" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View className="min-w-12 items-end">
        <WaitingPill count={waiting} />
      </View>
    </View>
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
  const insets = useSafeAreaInsets();

  return (
    <View className="absolute inset-0 bg-black/55 justify-end">
      <View
        className="bg-paper rounded-t-[28px] px-5 pt-3 max-h-[90%]"
        style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
        <View className="w-11 h-1.5 rounded-full bg-gray-300 self-center mb-3.5" />
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-2xl font-extrabold text-ink">Weigh setup</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            className="min-h-[48px] justify-center px-2">
            <Text className="text-base font-bold text-bloodline-600">Close</Text>
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled">
          <DateField
            label="Weigh date"
            value={draftDate}
            onChange={setDraftDate}
            maximumDate={new Date()}
          />
          <FieldLabel>Weigh point</FieldLabel>
          <View className="mb-4">
            <ChipRow>
              {WEIGH_POINTS.map((point) => (
                <Chip
                  key={point.value}
                  label={point.label}
                  selected={draftPoint === point.value}
                  onPress={() => setDraftPoint(point.value)}
                />
              ))}
            </ChipRow>
          </View>
          {draftPoint === 'weaning' ? (
            <Pressable
              onPress={() => setDraftWeaned((value) => !value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: draftWeaned }}
              className="flex-row items-center gap-3 min-h-[48px] mb-4">
              <View
                className={`w-8 h-8 rounded-[10px] items-center justify-center border-2 ${
                  draftWeaned
                    ? 'bg-bloodline-600 border-bloodline-600'
                    : 'border-gray-400 bg-white'
                }`}>
                {draftWeaned ? <Text className="text-lg font-extrabold text-white">✓</Text> : null}
              </View>
              <Text className="flex-1 text-[17px] font-semibold text-ink">
                Also mark these kids as weaned
              </Text>
            </Pressable>
          ) : null}
          <FieldLabel>Which goats?</FieldLabel>
          <View className="mb-4">
            <ChipRow>
              <Chip
                label="Whole herd"
                selected={draftGroup.kind === 'herd'}
                onPress={() => setDraftGroup({ kind: 'herd' })}
              />
              <Chip
                label="Kids"
                selected={draftGroup.kind === 'kids'}
                onPress={() => setDraftGroup({ kind: 'kids' })}
              />
              {pastures.map((pasture) => (
                <Chip
                  key={pasture.id}
                  label={pasture.name}
                  selected={
                    draftGroup.kind === 'pasture' && draftGroup.pastureId === pasture.id
                  }
                  onPress={() =>
                    setDraftGroup({ kind: 'pasture', pastureId: pasture.id })
                  }
                />
              ))}
            </ChipRow>
          </View>
        </ScrollView>
        <Button
          title="Start weighing"
          className="min-h-[60px] rounded-[18px]"
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
