import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { FarmWriteGate } from '@/components/FarmWriteGate';
import { ReadOnlyFarmBanner } from '@/components/ReadOnlyFarmBanner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import {
  animalMatchesSearch,
  formatAnimalAge,
  formatLivestockRowTitle,
  parseHerdStatusFilter,
  type HerdLifecycleFilter,
  type HerdSexFilter,
  type HerdStatusFilter,
} from '@/lib/domain/animals';
import { todayIso } from '@/lib/dates';
import { mapAnimal } from '@/lib/db/mappers';
import {
  activeWithdrawalsByAnimal,
  withdrawalBadgeLabel,
} from '@/lib/domain/health';
import {
  formatAnimalStatus,
  formatLifecycleStage,
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
      return animalMatchesSearch(animal, searchQuery);
    });
  }, [data, lifecycleFilter, searchQuery, sexFilter]);

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

  return (
    <View className="flex-1 bg-gray-50">
      {isHand ? (
        <View className="px-4 pt-3">
          <ReadOnlyFarmBanner />
        </View>
      ) : null}
      <View className="px-4 py-3 gap-3">
        <FarmWriteGate>
          <View className="flex-row gap-2">
            <Button
              title="Add Animal"
              onPress={() => router.push('/(tabs)/livestock/add')}
              className="flex-1"
            />
            <Button
              title="Weigh Day"
              variant="secondary"
              onPress={() => router.push('/(tabs)/livestock/weight')}
              className="flex-1"
            />
          </View>
        </FarmWriteGate>

        <Input
          label="Search herd"
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Name, tag, official ID, registration, tattoo"
        />

        <FilterChipRow
          label="Status"
          options={STATUS_FILTERS}
          value={statusFilter}
          onChange={setStatusFilter}
        />
        <FilterChipRow
          label="Sex"
          options={SEX_FILTERS}
          value={sexFilter}
          onChange={setSexFilter}
        />
        <FilterChipRow
          label="Stage"
          options={LIFECYCLE_FILTERS}
          value={lifecycleFilter}
          onChange={setLifecycleFilter}
        />
      </View>

      <FlatList
        data={animals}
        keyExtractor={(item) => item.id}
        contentContainerClassName={
          animals.length === 0 ? 'flex-grow' : 'px-4 pb-6'
        }
        ListEmptyComponent={
          <EmptyState
            title={
              statusFilter === 'active' && !searchQuery.trim()
                ? 'No active animals'
                : 'No goats match these filters'
            }
            description={
              statusFilter === 'active' && !searchQuery.trim()
                ? 'Add your first goat to start tracking weights and records.'
                : 'Try another search term or filter.'
            }
            actionLabel={
              statusFilter === 'active' && !searchQuery.trim()
                ? 'Add Animal'
                : undefined
            }
            onAction={
              statusFilter === 'active' && !searchQuery.trim()
                ? () => router.push('/(tabs)/livestock/add')
                : undefined
            }
          />
        }
        renderItem={({ item }) => (
          <LivestockRow
            animal={item}
            withdrawalLines={withdrawalLabels.get(item.id) ?? []}
          />
        )}
      />
    </View>
  );
}

function LivestockRow({
  animal,
  withdrawalLines,
}: {
  animal: Animal;
  withdrawalLines: string[];
}) {
  return (
    <Pressable
      onPress={() => router.push(`/(tabs)/livestock/${animal.id}`)}
      className="bg-white border border-gray-200 rounded-xl p-4 mb-2 active:bg-gray-50">
      <View className="flex-row justify-between items-start">
        <View className="flex-1 pr-3">
          <Text className="text-lg font-semibold text-gray-900">
            {formatLivestockRowTitle(animal)}
          </Text>
          <Text className="text-gray-500 capitalize mt-1">
            {animal.sex} · {formatLifecycleStage(animal.lifecycleStage)} ·{' '}
            {formatAnimalAge(animal.dateOfBirth)}
          </Text>
          {withdrawalLines.map((line) => (
            <Text key={line} className="text-amber-800 text-sm mt-1">
              {line}
            </Text>
          ))}
        </View>
        <Badge
          label={formatAnimalStatus(animal.status)}
          tone={statusBadgeTone(animal.status)}
        />
      </View>
    </Pressable>
  );
}

function FilterChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View>
      <Text className="text-xs font-medium text-gray-500 mb-1">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              className={`rounded-full border px-3 py-1.5 ${
                selected
                  ? 'border-bloodline-600 bg-bloodline-50'
                  : 'border-gray-300 bg-white'
              }`}>
              <Text
                className={`text-xs ${
                  selected ? 'text-bloodline-700 font-medium' : 'text-gray-700'
                }`}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
