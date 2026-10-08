import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlatList, ScrollView, Text, TextInput, View, Pressable } from 'react-native';

import { HerdFilterSheet } from '@/components/livestock/HerdFilterSheet';
import { ReadOnlyFarmBanner } from '@/components/ReadOnlyFarmBanner';
import { Badge } from '@/components/ui/Badge';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import {
  animalMatchesSearch,
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
import { useLocalHerd } from '@/hooks/useLocalHerd';
import {
  preferLocalRows,
  shouldShowReplicaLoading,
} from '@/lib/domain/offline-replica';
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
  const {
    activeFarm,
    isLoading: farmLoading,
    hasSyncedBefore,
  } = useFarm();
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
  const { animals: localHerd, resolved: localHerdResolved } = useLocalHerd(
    activeFarm?.id,
    statusFilter,
  );

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

  const queriedAnimals = useMemo(
    () =>
      (data ?? []).map((row) => mapAnimal(row as Record<string, unknown>)),
    [data],
  );
  const herdSource = useMemo(
    () => preferLocalRows(queriedAnimals, localHerd),
    [queriedAnimals, localHerd],
  );

  const animals = useMemo(() => {
    return herdSource.filter((animal) => {
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
    herdSource,
    lifecycleFilter,
    pastureByAnimal.pastureIds,
    pastureFilter,
    searchQuery,
    sexFilter,
    withdrawalLabels,
    withdrawalOnly,
  ]);

  const showHerdLoading = shouldShowReplicaLoading({
    hasSynced: hasSyncedBefore,
    localRowCount: herdSource.length,
    localQueryLoading: animalsLoading && !localHerdResolved,
  });

  if (farmLoading || (activeFarm && showHerdLoading)) {
    return <LoadingState message="Loading livestock…" />;
  }

  if (!activeFarm) {
    return (
      <View className="flex-1 bg-paper">
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

  const quickSexLife =
    sexFilter === 'all' && lifecycleFilter === 'all'
      ? 'all'
      : sexFilter === 'female' && lifecycleFilter === 'all'
        ? 'does'
        : sexFilter === 'male' && lifecycleFilter === 'all'
          ? 'bucks'
          : sexFilter === 'all' && lifecycleFilter === 'kid'
            ? 'kids'
            : null;
  // Filters already shown as quick chips are not repeated as removable chips.
  const extraChips = activeChips.filter(
    (chip) =>
      chip.key === 'status' ||
      chip.key === 'pasture' ||
      (chip.key === 'stage' && quickSexLife !== 'kids') ||
      (chip.key === 'sex' && quickSexLife !== 'does' && quickSexLife !== 'bucks'),
  );
  const goatCount = animals.length;

  return (
    <View className="flex-1 bg-paper" style={{ paddingTop: insets.top }}>
      {isHand ? (
        <View className="px-5 pt-3">
          <ReadOnlyFarmBanner />
        </View>
      ) : null}
      <View className="px-5 pt-6 pb-3">
        <Text className="text-[32px] leading-[35px] font-extrabold text-ink" accessibilityRole="header">
          Herd
        </Text>
        <Text className="text-[15px] font-semibold text-gray-500">
          {goatCount} goat{goatCount === 1 ? '' : 's'}
        </Text>
      </View>
      <View className="px-5 pb-3">
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Name or tag number"
          accessibilityLabel="Search by name or tag"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          className="h-14 border border-gray-300 rounded-[18px] px-4 text-lg bg-white text-ink"
          placeholderTextColor="#8a7b75"
        />
      </View>
      <View className="pb-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-5">
          <Chip
            label="All"
            selected={quickSexLife === 'all'}
            onPress={() => {
              setSexFilter('all');
              setLifecycleFilter('all');
            }}
          />
          <Chip
            label="Does"
            selected={quickSexLife === 'does'}
            onPress={() => {
              setSexFilter('female');
              setLifecycleFilter('all');
            }}
          />
          <Chip
            label="Bucks"
            selected={quickSexLife === 'bucks'}
            onPress={() => {
              setSexFilter('male');
              setLifecycleFilter('all');
            }}
          />
          <Chip
            label="Kids"
            selected={quickSexLife === 'kids'}
            onPress={() => {
              setSexFilter('all');
              setLifecycleFilter('kid');
            }}
          />
          <Chip
            label="In withdrawal"
            selected={withdrawalOnly}
            onPress={() => setWithdrawalOnly(!withdrawalOnly)}
          />
          {extraChips.map((chip) => (
            <Pressable
              key={chip.key}
              onPress={chip.onRemove}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${chip.label} filter`}
              className="h-12 px-[18px] rounded-full items-center justify-center bg-bloodline-900">
              <Text className="text-[17px] font-bold text-white">{chip.label} ×</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setFiltersOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={
              activeChips.length > 0
                ? `Filters, ${activeChips.length} active`
                : 'Filters'
            }
            className="h-12 px-[18px] rounded-full items-center justify-center border-2 border-bloodline-600 bg-white">
            <Text className="text-[17px] font-bold text-bloodline-600">
              {activeChips.length > 0 ? `Filters ${activeChips.length}` : 'Filters'}
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      <FlatList
        data={animals}
        keyExtractor={(item) => item.id}
        contentContainerClassName={
          animals.length === 0 ? 'flex-grow' : 'px-5 pb-8'
        }
        ListEmptyComponent={
          <EmptyState
            title={listIsUnfiltered ? 'No active animals' : 'No goats match'}
            description={
              listIsUnfiltered
                ? 'Add your first goat to start tracking weights and records.'
                : 'Try another search term or filter.'
            }
            actionLabel={listIsUnfiltered ? 'Add goat' : undefined}
            onAction={
              listIsUnfiltered
                ? () => router.push('/(tabs)/livestock/add')
                : undefined
            }
          />
        }
        renderItem={({ item, index }) => (
          <LivestockRow
            animal={item}
            first={index === 0}
            last={index === animals.length - 1}
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

    </View>
  );
}

function LivestockRow({
  animal,
  breedName,
  pastureName,
  withdrawalLines,
  first,
  last,
}: {
  animal: Animal;
  breedName?: string | null;
  pastureName?: string | null;
  withdrawalLines: string[];
  first: boolean;
  last: boolean;
}) {
  const name = animal.name?.trim();
  const tag = animal.tagNumber?.trim();
  return (
    <Pressable
      onPress={() => router.push(`/(tabs)/livestock/${animal.id}`)}
      accessibilityRole="button"
      className={`bg-white border-x border-gray-200 active:bg-gray-50 ${
        first ? 'border-t rounded-t-[22px]' : ''
      } ${last ? 'border-b rounded-b-[22px]' : ''}`}>
      <View
        className={`flex-row items-center gap-3 px-4 py-2.5 min-h-[76px] ${
          last ? '' : 'border-b border-gray-100'
        }`}>
        <View className="flex-1">
          <Text className="text-[19px] font-extrabold text-ink" numberOfLines={1}>
            {name ?? ''}
            {tag ? (
              <Text className="text-bloodline-600">
                {name ? ' ' : ''}#{tag}
              </Text>
            ) : null}
            {!name && !tag ? 'Unnamed animal' : ''}
          </Text>
          <Text className="text-[15px] text-gray-500" numberOfLines={1}>
            {herdRowSubtitle(animal, {
              breed: breedName,
              pasture: pastureName,
            })}
          </Text>
          {withdrawalLines.map((line) => (
            <Text key={line} className="text-[15px] font-semibold text-ink mt-0.5">
              {line}
            </Text>
          ))}
        </View>
        {withdrawalLines.length > 0 ? (
          <Badge label="Do not sell" tone="danger" />
        ) : animal.status !== 'active' ? (
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
