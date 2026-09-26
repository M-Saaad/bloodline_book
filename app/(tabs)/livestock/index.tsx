import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { FarmWriteGate } from '@/components/FarmWriteGate';
import { HerdFilterSheet } from '@/components/livestock/HerdFilterSheet';
import { ReadOnlyFarmBanner } from '@/components/ReadOnlyFarmBanner';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import {
  animalMatchesSearch,
  formatLivestockRowTitle,
  parseHerdStatusFilter,
  type HerdLifecycleFilter,
  type HerdSexFilter,
  type HerdStatusFilter,
} from '@/lib/domain/animals';
import { compareHerdOrder, herdRowSubtitle } from '@/lib/ui/animal-picker';
import { todayIso } from '@/lib/dates';
import { mapAnimal } from '@/lib/db/mappers';
import {
  activeWithdrawalsByAnimal,
  withdrawalBadgeLabel,
} from '@/lib/domain/health';
import {
  formatAnimalStatus,
  statusBadgeTone,
} from '@/lib/ui/animal-labels';
import { useFarmRole } from '@/hooks/useFarmRole';
import type { Animal } from '@/lib/types/animals';
import { useFarm } from '@/providers/FarmProvider';

const STATUS_FILTERS: { value: HerdStatusFilter; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'sold', label: 'Sold' },
  { value: 'died', label: 'Dead' },
  { value: 'slaughtered', label: 'Slaughtered' },
  { value: 'transferred', label: 'Transferred' },
  { value: 'all', label: 'All' },
];

const SEX_FILTERS: { value: HerdSexFilter; label: string }[] = [
  { value: 'all', label: 'All sexes' },
  { value: 'female', label: 'Does' },
  { value: 'male', label: 'Bucks' },
];

const LIFECYCLE_FILTERS: { value: HerdLifecycleFilter; label: string }[] = [
  { value: 'all', label: 'All stages' },
  { value: 'kid', label: 'Kids' },
  { value: 'weaned', label: 'Weaned' },
  { value: 'yearling', label: 'Yearlings' },
  { value: 'breeding', label: 'Breeding' },
  { value: 'feeder', label: 'Feeders' },
  { value: 'market_ready', label: 'Market ready' },
  { value: 'adult', label: 'Adults' },
];

export default function LivestockListScreen() {
  const { activeFarm, isLoading: farmLoading } = useFarm();
  const { isHand } = useFarmRole();
  const params = useLocalSearchParams<{ status?: string }>();
  const initialStatus = parseHerdStatusFilter(params.status);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<HerdStatusFilter>(initialStatus);
  const [sexFilter, setSexFilter] = useState<HerdSexFilter>('all');
  const [lifecycleFilter, setLifecycleFilter] =
    useState<HerdLifecycleFilter>('all');
  const [pastureFilter, setPastureFilter] = useState<string | null>(null);
  const [withdrawalOnly, setWithdrawalOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    setStatusFilter(parseHerdStatusFilter(params.status));
  }, [params.status]);

  const querySql =
    activeFarm && statusFilter === 'all'
      ? `SELECT * FROM animals
         WHERE farm_id = ?
         ORDER BY COALESCE(name, tag_number, id)`
      : activeFarm
        ? `SELECT * FROM animals
           WHERE farm_id = ? AND status = ?
           ORDER BY COALESCE(name, tag_number, id)`
        : 'SELECT 1 WHERE 0';

  const queryParams =
    activeFarm && statusFilter === 'all'
      ? [activeFarm.id]
      : activeFarm
        ? [activeFarm.id, statusFilter]
        : [];

  const { data, isLoading: animalsLoading } = useQuery(querySql, queryParams);

  const { data: healthRows } = useQuery(
    activeFarm
      ? `SELECT animal_id, date, product_name, meat_withdrawal_days,
                milk_withdrawal_days, withdrawal_days
         FROM health_records WHERE farm_id = ?`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const withdrawalLabels = useMemo(() => {
    const today = todayIso();
    const badges = activeWithdrawalsByAnimal(
      (healthRows ?? []).map((row) => {
        const record = row as Record<string, unknown>;
        return {
          animalId: String(record.animal_id),
          date: String(record.date),
          productName:
            record.product_name != null ? String(record.product_name) : null,
          meatDays:
            record.meat_withdrawal_days != null
              ? Number(record.meat_withdrawal_days)
              : null,
          milkDays:
            record.milk_withdrawal_days != null
              ? Number(record.milk_withdrawal_days)
              : null,
          legacyDays:
            record.withdrawal_days != null
              ? Number(record.withdrawal_days)
              : null,
        };
      }),
      today,
    );
    const labels = new Map<string, string[]>();
    for (const [animalId, badge] of badges) {
      const lines: string[] = [];
      if (badge.meat) {
        lines.push(withdrawalBadgeLabel('meat', badge.meat.clearDate));
      }
      if (
        badge.milk &&
        activeFarm &&
        (activeFarm.segment === 'dairy' || activeFarm.segment === 'both')
      ) {
        lines.push(withdrawalBadgeLabel('milk', badge.milk.clearDate));
      }
      if (lines.length > 0) {
        labels.set(animalId, lines);
      }
    }
    return labels;
  }, [activeFarm, healthRows]);

  const { data: grazingRows } = useQuery(
    activeFarm
      ? `SELECT g.animal_id, p.id as pasture_id, p.name
         FROM grazing_records g
         JOIN pastures p ON p.id = g.pasture_id
         WHERE g.farm_id = ? AND g.end_date IS NULL`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const { data: breedRows } = useQuery(
    'SELECT id, name FROM breeds',
    [],
  );

  const pastureByAnimal = useMemo(() => {
    const names: Record<string, string> = {};
    const pastureIds: Record<string, string> = {};
    for (const row of grazingRows ?? []) {
      const record = row as {
        animal_id: string;
        pasture_id: string;
        name: string;
      };
      names[String(record.animal_id)] = String(record.name);
      pastureIds[String(record.animal_id)] = String(record.pasture_id);
    }
    return { names, pastureIds };
  }, [grazingRows]);

  const breedNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const row of breedRows ?? []) {
      const record = row as { id: string; name: string };
      names[String(record.id)] = String(record.name);
    }
    return names;
  }, [breedRows]);

  const pastureOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of grazingRows ?? []) {
      const record = row as { pasture_id: string; name: string };
      seen.set(String(record.pasture_id), String(record.name));
    }
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [grazingRows]);

  const animals = useMemo(() => {
    const mapped = (data ?? []).map((row) =>
      mapAnimal(row as Record<string, unknown>),
    );

    return mapped.filter((animal) => {
      if (sexFilter !== 'all' && animal.sex !== sexFilter) {
        return false;
      }
      if (
        lifecycleFilter !== 'all' &&
        animal.lifecycleStage !== lifecycleFilter
      ) {
        return false;
      }
      if (
        pastureFilter &&
        pastureByAnimal.pastureIds[animal.id] !== pastureFilter
      ) {
        return false;
      }
      if (withdrawalOnly && !withdrawalLabels.has(animal.id)) {
        return false;
      }
      return animalMatchesSearch(animal, searchQuery);
    }).sort(compareHerdOrder);
  }, [
    data,
    lifecycleFilter,
    pastureByAnimal.pastureIds,
    pastureFilter,
    searchQuery,
    sexFilter,
    withdrawalLabels,
    withdrawalOnly,
  ]);

  if (farmLoading || (activeFarm && animalsLoading)) {
    return <LoadingState message="Loading livestock…" />;
  }

  if (!activeFarm) {
    return (
      <View className="flex-1 bg-gray-50">
        <EmptyState
          title="No farm selected"
          description="Create or select a farm to manage your herd."
        />
      </View>
    );
  }

  const activeChips = herdFilterChips({
    statusFilter,
    sexFilter,
    lifecycleFilter,
    pastureFilter,
    pastureOptions,
    withdrawalOnly,
    onStatus: setStatusFilter,
    onSex: setSexFilter,
    onLifecycle: setLifecycleFilter,
    onPasture: setPastureFilter,
    onWithdrawal: setWithdrawalOnly,
  });
  const listIsUnfiltered =
    activeChips.length === 0 && !searchQuery.trim();

  return (
    <View className="flex-1 bg-gray-50">
      {isHand ? (
        <View className="px-4 pt-3">
          <ReadOnlyFarmBanner />
        </View>
      ) : null}
      <View className="px-4 pt-3 pb-2">
        <View className="flex-row items-center gap-2">
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search name or tag"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            className="flex-1 border border-gray-300 rounded-xl px-4 min-h-[48px] text-base bg-white text-gray-900"
            placeholderTextColor="#4b5563"
          />
          <Pressable
            onPress={() => setFiltersOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={
              activeChips.length > 0
                ? `Filters, ${activeChips.length} active`
                : 'Filters'
            }
            className={`min-h-[48px] min-w-[48px] px-3 rounded-xl items-center justify-center ${
              activeChips.length > 0 ? 'bg-bloodline-600' : 'bg-white border border-gray-300'
            }`}>
            <Text
              className={`font-semibold ${
                activeChips.length > 0 ? 'text-white' : 'text-gray-900'
              }`}>
              {activeChips.length > 0 ? `Filters ${activeChips.length}` : 'Filters'}
            </Text>
          </Pressable>
        </View>
        {activeChips.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-2"
            contentContainerClassName="gap-2">
            {activeChips.map((chip) => (
              <Pressable
                key={chip.key}
                onPress={chip.onRemove}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${chip.label} filter`}
                className="min-h-[44px] justify-center rounded-full bg-bloodline-600 px-4">
                <Text className="text-white font-semibold">{chip.label} ×</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <FlatList
        data={animals}
        keyExtractor={(item) => item.id}
        contentContainerClassName={
          animals.length === 0 ? 'flex-grow' : 'px-4 pb-28'
        }
        ListEmptyComponent={
          <EmptyState
            title={listIsUnfiltered ? 'No active animals' : 'No goats match'}
            description={
              listIsUnfiltered
                ? 'Add your first goat to start tracking weights and records.'
                : 'Try another search term or filter.'
            }
            actionLabel={listIsUnfiltered ? 'Add Animal' : undefined}
            onAction={
              listIsUnfiltered
                ? () => router.push('/(tabs)/livestock/add')
                : undefined
            }
          />
        }
        renderItem={({ item }) => (
          <LivestockRow
            animal={item}
            breedName={
              item.breedPrimaryId ? breedNames[item.breedPrimaryId] : null
            }
            pastureName={pastureByAnimal.names[item.id] ?? null}
            withdrawalLines={withdrawalLabels.get(item.id) ?? []}
          />
        )}
      />

      <HerdFilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        status={statusFilter}
        sex={sexFilter}
        lifecycle={lifecycleFilter}
        pastureId={pastureFilter}
        withdrawalOnly={withdrawalOnly}
        statusOptions={STATUS_FILTERS}
        sexOptions={SEX_FILTERS}
        lifecycleOptions={LIFECYCLE_FILTERS}
        pastures={pastureOptions}
        onStatus={setStatusFilter}
        onSex={setSexFilter}
        onLifecycle={setLifecycleFilter}
        onPasture={setPastureFilter}
        onWithdrawal={setWithdrawalOnly}
        onClear={() => {
          setStatusFilter('active');
          setSexFilter('all');
          setLifecycleFilter('all');
          setPastureFilter(null);
          setWithdrawalOnly(false);
        }}
        matchCount={animals.length}
      />

      <FarmWriteGate>
        <Pressable
          onPress={() => router.push('/(tabs)/livestock/add')}
          accessibilityRole="button"
          accessibilityLabel="Add animal"
          className="absolute right-4 h-14 w-14 rounded-full bg-bloodline-600 items-center justify-center"
          style={{ bottom: Math.max(insets.bottom, 16) + 12 }}>
          <Text className="text-white text-3xl leading-8">+</Text>
        </Pressable>
      </FarmWriteGate>
    </View>
  );
}

function LivestockRow({
  animal,
  breedName,
  pastureName,
  withdrawalLines,
}: {
  animal: Animal;
  breedName?: string | null;
  pastureName?: string | null;
  withdrawalLines: string[];
}) {
  return (
    <Pressable
      onPress={() => router.push(`/(tabs)/livestock/${animal.id}`)}
      className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-2 min-h-[56px] active:bg-gray-50">
      <View className="flex-row justify-between items-start">
        <View className="flex-1 pr-3">
          <Text className="text-lg font-semibold text-gray-900" numberOfLines={1}>
            {formatLivestockRowTitle(animal)}
          </Text>
          <Text className="text-gray-700 mt-1" numberOfLines={1}>
            {herdRowSubtitle(animal, {
              breed: breedName,
              pasture: pastureName,
            })}
          </Text>
          {withdrawalLines.map((line) => (
            <Text key={line} className="text-amber-800 text-sm mt-1">
              {line}
            </Text>
          ))}
        </View>
        {animal.status !== 'active' ? (
          <Badge
            label={formatAnimalStatus(animal.status)}
            tone={statusBadgeTone(animal.status)}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

function herdFilterChips(input: {
  statusFilter: HerdStatusFilter;
  sexFilter: HerdSexFilter;
  lifecycleFilter: HerdLifecycleFilter;
  pastureFilter: string | null;
  pastureOptions: { id: string; name: string }[];
  withdrawalOnly: boolean;
  onStatus: (value: HerdStatusFilter) => void;
  onSex: (value: HerdSexFilter) => void;
  onLifecycle: (value: HerdLifecycleFilter) => void;
  onPasture: (value: string | null) => void;
  onWithdrawal: (value: boolean) => void;
}): { key: string; label: string; onRemove: () => void }[] {
  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if (input.statusFilter !== 'active') {
    const match = STATUS_FILTERS.find((option) => option.value === input.statusFilter);
    chips.push({
      key: 'status',
      label: match?.label ?? input.statusFilter,
      onRemove: () => input.onStatus('active'),
    });
  }
  if (input.sexFilter !== 'all') {
    const match = SEX_FILTERS.find((option) => option.value === input.sexFilter);
    chips.push({
      key: 'sex',
      label: match?.label ?? input.sexFilter,
      onRemove: () => input.onSex('all'),
    });
  }
  if (input.lifecycleFilter !== 'all') {
    const match = LIFECYCLE_FILTERS.find(
      (option) => option.value === input.lifecycleFilter,
    );
    chips.push({
      key: 'stage',
      label: match?.label ?? input.lifecycleFilter,
      onRemove: () => input.onLifecycle('all'),
    });
  }
  if (input.pastureFilter) {
    const match = input.pastureOptions.find(
      (pasture) => pasture.id === input.pastureFilter,
    );
    chips.push({
      key: 'pasture',
      label: match?.name ?? 'Pasture',
      onRemove: () => input.onPasture(null),
    });
  }
  if (input.withdrawalOnly) {
    chips.push({
      key: 'withdrawal',
      label: 'In withdrawal',
      onRemove: () => input.onWithdrawal(false),
    });
  }
  return chips;
}
