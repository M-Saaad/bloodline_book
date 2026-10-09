import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FarmWriteGate } from '@/components/FarmWriteGate';
import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { mapAnimal, mapBreedingEvent, mapHealthRecord, mapKiddingEvent } from '@/lib/db/mappers';
import { formatDisplayDate, formatMonthDay, todayIso } from '@/lib/dates';
import {
  formatDueWindowPhrase,
  formatWindowCompact,
  resolveBreedingWindow,
} from '@/lib/domain/breeding';
import { litterSummaryLabel } from '@/lib/domain/kidding';
import {
  activeWithdrawalsByAnimal,
  withdrawalBadgeLabel,
} from '@/lib/domain/health';
import { formatHealthRecordKind } from '@/lib/ui/health-labels';
import {
  animalDisplayLabel,
  formatAnimalStatus,
  formatLifecycleStage,
  formatRegistrationBody,
  statusBadgeTone,
} from '@/lib/ui/animal-labels';
import { useFarm } from '@/providers/FarmProvider';
import { Text } from '@/components/ui/Text';

export default function AnimalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeFarm } = useFarm();
  const insets = useSafeAreaInsets();

  const { data: animalRows, isLoading: animalLoading } = useQuery(
    id ? 'SELECT * FROM animals WHERE id = ?' : 'SELECT 1 WHERE 0',
    id ? [id] : [],
  );

  const { data: breedRows } = useQuery(
    animalRows?.[0]?.breed_primary_id
      ? 'SELECT name FROM breeds WHERE id = ?'
      : 'SELECT 1 WHERE 0',
    animalRows?.[0]?.breed_primary_id
      ? [animalRows[0].breed_primary_id]
      : [],
  );

  const { data: pastureRows } = useQuery(
    id
      ? `SELECT p.id, p.name, g.start_date
         FROM grazing_records g
         JOIN pastures p ON p.id = g.pasture_id
         WHERE g.animal_id = ? AND g.end_date IS NULL
         LIMIT 1`
      : 'SELECT 1 WHERE 0',
    id ? [id] : [],
  );

  const { data: healthRows, isLoading: healthLoading } = useQuery(
    id
      ? `SELECT * FROM health_records
         WHERE animal_id = ?
         ORDER BY date DESC, created_at DESC
         LIMIT 10`
      : 'SELECT 1 WHERE 0',
    id ? [id] : [],
  );

  const { data: weightRows, isLoading: weightsLoading } = useQuery(
    id
      ? `SELECT wl.id, ws.date, ws.weigh_point, wl.weight_value, wl.weight_unit
         FROM weight_logs wl
         JOIN weigh_sessions ws ON ws.id = wl.weigh_session_id
         WHERE wl.animal_id = ?
         ORDER BY ws.date DESC, wl.created_at DESC`
      : 'SELECT 1 WHERE 0',
    id ? [id] : [],
  );

  const { data: offspringRows } = useQuery(
    id
      ? `SELECT * FROM animals
         WHERE dam_id = ? OR sire_id = ?
         ORDER BY COALESCE(date_of_birth, created_at) DESC, created_at DESC`
      : 'SELECT 1 WHERE 0',
    id ? [id, id] : [],
  );

  const damId = animalRows?.[0]?.dam_id as string | undefined;
  const sireId = animalRows?.[0]?.sire_id as string | undefined;

  const { data: damRows } = useQuery(
    damId ? 'SELECT id, name, tag_number FROM animals WHERE id = ?' : 'SELECT 1 WHERE 0',
    damId ? [damId] : [],
  );

  const { data: sireRows } = useQuery(
    sireId ? 'SELECT id, name, tag_number FROM animals WHERE id = ?' : 'SELECT 1 WHERE 0',
    sireId ? [sireId] : [],
  );

  const { data: breedingRows } = useQuery(
    id && animalRows?.[0]?.sex === 'female'
      ? `SELECT b.*, s.name AS sire_name, s.tag_number AS sire_tag
         FROM breeding_events b
         LEFT JOIN animals s ON s.id = b.sire_id
         WHERE b.dam_id = ?
         ORDER BY b.bred_date DESC`
      : 'SELECT 1 WHERE 0',
    id && animalRows?.[0]?.sex === 'female' ? [id] : [],
  );

  const litterId = animalRows?.[0]?.litter_id as string | undefined;

  const { data: litterKiddingRows } = useQuery(
    litterId
      ? 'SELECT * FROM kidding_events WHERE id = ?'
      : 'SELECT 1 WHERE 0',
    litterId ? [litterId] : [],
  );

  const { data: siblingRows } = useQuery(
    litterId
      ? `SELECT id, name, tag_number FROM animals
         WHERE litter_id = ? AND id != ?
         ORDER BY created_at ASC`
      : 'SELECT 1 WHERE 0',
    litterId && id ? [litterId, id] : [],
  );

  const { data: withdrawalRows } = useQuery(
    id
      ? `SELECT animal_id, date, product_name, meat_withdrawal_days,
                milk_withdrawal_days, withdrawal_days
         FROM health_records WHERE animal_id = ?`
      : 'SELECT 1 WHERE 0',
    id ? [id] : [],
  );

  const { data: kiddingRows } = useQuery(
    id && animalRows?.[0]?.sex === 'female'
      ? `SELECT * FROM kidding_events
         WHERE dam_id = ?
         ORDER BY kid_date DESC`
      : 'SELECT 1 WHERE 0',
    id && animalRows?.[0]?.sex === 'female' ? [id] : [],
  );

  if (!activeFarm || !id) {
    return null;
  }

  if (animalLoading) {
    return <LoadingState message="Loading animal…" />;
  }

  const animalRow = animalRows?.[0];
  if (!animalRow) {
    return (
      <View className="flex-1 bg-paper">
        <EmptyState
          title="Animal not found"
          description="This animal may have been removed or is not on this farm."
          actionLabel="Back to Livestock"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const animal = mapAnimal(animalRow as Record<string, unknown>);
  const breedName =
    breedRows?.[0]?.name != null ? String(breedRows[0].name) : null;
  const displayName = animal.name ?? animal.tagNumber ?? 'Unnamed';
  const weights = weightRows ?? [];
  const birthWeight = weights.find(
    (row) => String((row as { weigh_point?: string }).weigh_point) === 'birth',
  ) as { weight_value?: number; weight_unit?: string } | undefined;
  const withdrawal = activeWithdrawalsByAnimal(
    (withdrawalRows ?? []).map((row) => {
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
          record.withdrawal_days != null ? Number(record.withdrawal_days) : null,
      };
    }),
    todayIso(),
  ).get(animal.id);
  const litterKidding = litterKiddingRows?.[0]
    ? mapKiddingEvent(litterKiddingRows[0] as Record<string, unknown>)
    : null;

  const activeBreeding = (breedingRows ?? [])
    .map((row) => {
      const record = row as Record<string, unknown>;
      const breeding = mapBreedingEvent(record);
      return { record, breeding };
    })
    .find(
      ({ breeding }) =>
        breeding.status === 'bred' || breeding.status === 'confirmed',
    );
  const activeWindow = activeBreeding
    ? resolveBreedingWindow(activeBreeding.breeding, activeFarm.gestationDays)
    : null;
  const activeSire = activeBreeding
    ? activeBreeding.breeding.sireId
      ? String(
          activeBreeding.record.sire_name ??
            activeBreeding.record.sire_tag ??
            '',
        )
      : activeBreeding.breeding.sireExternalName
    : null;
  const latestWeight = weights[0] as
    | { date: string; weight_value: number; weight_unit: string }
    | undefined;
  const previousWeight = weights[1] as
    | { date: string; weight_value: number; weight_unit: string }
    | undefined;
  const weightChange =
    latestWeight &&
    previousWeight &&
    latestWeight.weight_unit === previousWeight.weight_unit
      ? Math.round((latestWeight.weight_value - previousWeight.weight_value) * 10) / 10
      : null;
  const trend = weights
    .slice(0, 8)
    .reverse()
    .map((row) => Number((row as { weight_value: number }).weight_value))
    .filter((value) => Number.isFinite(value));
  const trendMax = Math.max(...trend, 1);
  const trendMin = Math.min(...trend, trendMax);
  const showMilkBanner =
    Boolean(withdrawal?.milk) &&
    (activeFarm.segment === 'dairy' || activeFarm.segment === 'both');
  const subtitle = [
    breedName,
    animal.sex === 'female' ? 'Doe' : 'Buck',
    pastureRows?.[0]?.name != null ? String(pastureRows[0].name) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const quickActions =
    animal.sex === 'female'
      ? [
          {
            label: 'Weigh',
            onPress: () =>
              router.push({
                pathname: '/(tabs)/livestock/weight',
                params: { animalId: animal.id },
              }),
          },
          {
            label: 'Treat',
            onPress: () =>
              router.push({
                pathname: '/(tabs)/more/health/add',
                params: { animalId: animal.id },
              }),
          },
          {
            label: 'Move',
            onPress: () =>
              router.push({
                pathname: '/(tabs)/land/add-grazing',
                params: { animalId: animal.id },
              }),
          },
          {
            label: 'Kidding',
            onPress: () =>
              router.push({
                pathname: '/(tabs)/more/breeding/add-kidding',
                params: { damId: animal.id },
              }),
          },
        ]
      : [
          {
            label: 'Weigh',
            onPress: () =>
              router.push({
                pathname: '/(tabs)/livestock/weight',
                params: { animalId: animal.id },
              }),
          },
          {
            label: 'Treat',
            onPress: () =>
              router.push({
                pathname: '/(tabs)/more/health/add',
                params: { animalId: animal.id },
              }),
          },
          {
            label: 'Move',
            onPress: () =>
              router.push({
                pathname: '/(tabs)/land/add-grazing',
                params: { animalId: animal.id },
              }),
          },
          {
            label: 'Breed',
            onPress: () =>
              router.push({
                pathname: '/(tabs)/more/breeding/add-breeding',
                params: { sireId: animal.id },
              }),
          },
        ];

  return (
    <View className="flex-1 bg-paper">
    <ScrollView
      className="flex-1"
      contentContainerClassName="pb-36">
      <View
        className="bg-bloodline-900 px-5 pb-5 rounded-b-[28px]"
        style={{ paddingTop: Math.max(insets.top, 8) + 12 }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="w-12 h-12 rounded-full bg-white/15 items-center justify-center">
          <Text className="text-[28px] leading-8 text-white">‹</Text>
        </Pressable>
        <View className="flex-row items-center gap-4 mt-3">
          <View className="w-[68px] h-[68px] rounded-full bg-bloodline-100 items-center justify-center">
            <Text className="text-[32px] font-extrabold text-bloodline-900">
              {displayName.trim().charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-[34px] leading-[37px] font-extrabold text-white" numberOfLines={2}>
              {animal.name ?? animal.tagNumber ?? 'Unnamed'}
              {animal.name && animal.tagNumber ? (
                <Text className="font-bold text-white/85"> #{animal.tagNumber}</Text>
              ) : null}
            </Text>
            <Text className="text-base text-white/90 mt-0.5" numberOfLines={2}>
              {subtitle}
            </Text>
            <View className="flex-row mt-2">
              <Badge
                label={formatAnimalStatus(animal.status)}
                tone={statusBadgeTone(animal.status)}
              />
            </View>
          </View>
        </View>
      </View>

      <View className="px-5 pt-4 gap-3.5">
      {withdrawal?.meat || showMilkBanner || (activeBreeding && activeWindow) ? (
        <View className="gap-2.5">
          {withdrawal?.meat ? (
            <Banner
              tone="stop"
              title={`Do not sell until ${formatMonthDay(withdrawal.meat.clearDate)}`}
              message={withdrawalBadgeLabel('meat', withdrawal.meat.clearDate)}
            />
          ) : null}
          {showMilkBanner && withdrawal?.milk ? (
            <Banner
              tone="stop"
              title={`Do not use milk until ${formatMonthDay(withdrawal.milk.clearDate)}`}
              message={withdrawalBadgeLabel('milk', withdrawal.milk.clearDate)}
            />
          ) : null}
          {activeBreeding && activeWindow ? (
            <Banner
              tone="amber"
              title={`Kidding window ${formatWindowCompact(activeWindow.windowStart, activeWindow.windowEnd)}`}
              message={`Bred${activeSire ? ` to ${activeSire}` : ''} on ${formatMonthDay(activeBreeding.breeding.bredDate)}`}
            />
          ) : null}
        </View>
      ) : null}

      <Card>
        <View className="flex-row justify-between items-end">
          <View>
            <Text className="text-[15px] font-semibold text-gray-500">Weight</Text>
            <Text className="text-[38px] leading-[42px] font-extrabold text-ink">
              {latestWeight
                ? `${latestWeight.weight_value} ${latestWeight.weight_unit}`
                : 'No weight yet'}
            </Text>
          </View>
          {weightChange != null && previousWeight ? (
            <Badge
              label={`${weightChange > 0 ? '+' : ''}${weightChange} ${previousWeight.weight_unit} since ${formatMonthDay(previousWeight.date)}`}
              tone={weightChange >= 0 ? 'success' : 'warning'}
            />
          ) : null}
        </View>
        {trend.length > 1 ? (
          <View className="flex-row items-end gap-1.5 h-12 mt-3">
            {trend.map((value, index) => (
              <View
                key={index}
                className={`flex-1 rounded-md ${
                  index === trend.length - 1 ? 'bg-bloodline-600' : 'bg-bloodline-200'
                }`}
                style={{
                  height:
                    trendMax === trendMin
                      ? 36
                      : 12 + ((value - trendMin) / (trendMax - trendMin)) * 36,
                }}
              />
            ))}
          </View>
        ) : null}
      </Card>

      <Card>
        <View className="gap-2.5">
          <DetailRow label="Breed" value={breedName ?? 'Not set'} />
          {animal.breedPercentage != null ? (
            <DetailRow
              label="Breed %"
              value={`${animal.breedPercentage}%`}
            />
          ) : null}
          <DetailRow label="Sex" value={animal.sex} capitalize />
          <DetailRow
            label="Lifecycle"
            value={formatLifecycleStage(animal.lifecycleStage)}
            capitalize
          />
          {animal.dateOfBirth ? (
            <DetailRow label="Date of birth" value={animal.dateOfBirth} />
          ) : null}
          {animal.outDate ? (
            <DetailRow label="Out date" value={animal.outDate} />
          ) : null}
          {pastureRows?.[0]?.name != null ? (
            <DetailRow
              label="Pasture"
              value={`${String(pastureRows[0].name)} since ${formatDisplayDate(String(pastureRows[0].start_date))}`}
            />
          ) : (
            <DetailRow label="Pasture" value="Not assigned" />
          )}
          {animal.notes ? (
            <View className="mt-2 pt-3 border-t border-gray-100">
              <Text className="text-[15px] text-gray-500 mb-1">Notes</Text>
              <Text className="text-[17px] leading-6 text-ink">{animal.notes}</Text>
            </View>
          ) : null}
        </View>
      </Card>

      <Card>
        <Text className="text-xl font-extrabold text-ink mb-3">Identity</Text>
        <View className="gap-2.5">
          {animal.tagNumber ? (
            <DetailRow label="Tag" value={animal.tagNumber} />
          ) : null}
          {animal.officialId ? (
            <DetailRow label="Official ID" value={animal.officialId} />
          ) : null}
          {animal.registrationBody ? (
            <DetailRow
              label="Registry"
              value={`${formatRegistrationBody(animal.registrationBody) ?? ''}${
                animal.registrationNumber
                  ? ` · ${animal.registrationNumber}`
                  : ''
              }`}
            />
          ) : animal.registrationNumber ? (
            <DetailRow
              label="Registration number"
              value={animal.registrationNumber}
            />
          ) : null}
          {animal.tattoo ? (
            <DetailRow label="Tattoo" value={animal.tattoo} />
          ) : null}
          {!animal.tagNumber &&
          !animal.officialId &&
          !animal.registrationBody &&
          !animal.registrationNumber &&
          !animal.tattoo ? (
            <Text className="text-gray-500">No identity details recorded yet.</Text>
          ) : null}
        </View>
      </Card>

      <Card>
        <Text className="text-xl font-extrabold text-ink mb-3">Parents</Text>
        <View className="gap-2.5">
          {damRows?.[0] ? (
            <ParentLink
              label="Dam"
              animalId={String(damRows[0].id)}
              name={String(damRows[0].name ?? '')}
              tagNumber={
                damRows[0].tag_number != null
                  ? String(damRows[0].tag_number)
                  : null
              }
            />
          ) : animal.damExternalName ? (
            <DetailRow label="Dam" value={animal.damExternalName} />
          ) : (
            <DetailRow label="Dam" value="Not set" />
          )}
          {sireRows?.[0] ? (
            <ParentLink
              label="Sire"
              animalId={String(sireRows[0].id)}
              name={String(sireRows[0].name ?? '')}
              tagNumber={
                sireRows[0].tag_number != null
                  ? String(sireRows[0].tag_number)
                  : null
              }
            />
          ) : animal.sireExternalName ? (
            <DetailRow label="Sire" value={animal.sireExternalName} />
          ) : (
            <DetailRow label="Sire" value="Not set" />
          )}
        </View>
      </Card>

      {(offspringRows ?? []).length > 0 ? (
        <Card>
          <Text className="text-xl font-extrabold text-ink mb-3">
            Offspring
          </Text>
          {(offspringRows ?? []).map((row) => {
            const kid = mapAnimal(row as Record<string, unknown>);
            return (
              <Pressable
                key={kid.id}
                onPress={() => router.push(`/(tabs)/livestock/${kid.id}`)}
                className="min-h-[56px] justify-center py-2 border-b border-gray-100">
                <GoatName name={kid.name} tag={kid.tagNumber} id={kid.id} />
                <Text className="text-gray-500 text-[15px] capitalize">
                  {kid.sex} · {formatLifecycleStage(kid.lifecycleStage)}
                </Text>
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      {litterKidding ? (
        <Card>
          <Text className="text-xl font-extrabold text-ink mb-2">Litter</Text>
          <Text className="text-[17px] text-ink">
            {litterSummaryLabel(
              litterKidding.kidsBorn,
              litterKidding.kidsSurviving ?? litterKidding.kidsBorn,
            )}
          </Text>
          {birthWeight?.weight_value != null ? (
            <Text className="text-gray-500 mt-1">
              Birth weight {birthWeight.weight_value} {birthWeight.weight_unit}
            </Text>
          ) : null}
          {(siblingRows ?? []).map((row) => {
            const sibling = row as {
              id: string;
              name: string | null;
              tag_number: string | null;
            };
            return (
              <Pressable
                key={sibling.id}
                onPress={() => router.push(`/(tabs)/livestock/${sibling.id}`)}
                className="min-h-[56px] justify-center py-2 border-b border-gray-100">
                {sibling.name?.trim() || sibling.tag_number ? (
                  <GoatName name={sibling.name} tag={sibling.tag_number} id={sibling.id} />
                ) : (
                  <Text className="text-[17px] text-bloodline-600 font-bold">Litter mate</Text>
                )}
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      {animal.sex === 'female' ? (
        <Card>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xl font-extrabold text-ink">
              Breeding history
            </Text>
            <FarmWriteGate>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/more/breeding/add-breeding',
                    params: { damId: animal.id },
                  })
                }
                className="min-h-[44px] justify-center px-2">
                <Text className="text-bloodline-600 font-semibold">Log breeding</Text>
              </Pressable>
            </FarmWriteGate>
          </View>
          {(breedingRows ?? []).length === 0 ? (
            <Text className="text-gray-500">No breedings recorded yet.</Text>
          ) : null}
          {(breedingRows ?? []).map((row) => {
            const record = row as Record<string, unknown>;
            const breeding = mapBreedingEvent(record);
            const window = resolveBreedingWindow(
              breeding,
              activeFarm.gestationDays,
            );
            const sire = breeding.sireId
              ? String(record.sire_name ?? record.sire_tag ?? 'On-farm sire')
              : breeding.sireExternalName;
            return (
              <Pressable
                key={breeding.id}
                onPress={() =>
                  router.push(
                    `/(tabs)/more/breeding/edit-breeding/${breeding.id}`,
                  )
                }
                className="min-h-[56px] justify-center py-2 border-b border-gray-100">
                <Text className="text-ink font-bold capitalize">
                  {formatDisplayDate(breeding.bredDate)} · {breeding.status}
                </Text>
                <Text className="text-gray-500 text-[15px] mt-1">
                  {sire ? `Buck ${sire}` : 'Buck not recorded'}
                  {window
                    ? ` · ${formatDueWindowPhrase(window.windowStart, window.windowEnd)}`
                    : ''}
                </Text>
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      {animal.sex === 'female' && (kiddingRows ?? []).length > 0 ? (
        <Card>
          <Text className="text-xl font-extrabold text-ink mb-3">
            Kidding history
          </Text>
          {(kiddingRows ?? []).map((row) => {
            const kidding = mapKiddingEvent(row as Record<string, unknown>);
            const surviving =
              kidding.kidsSurviving != null
                ? kidding.kidsSurviving
                : kidding.kidsBorn;
            return (
              <View
                key={kidding.id}
                className="min-h-[56px] justify-center py-2 border-b border-gray-100">
                <Text className="text-ink font-bold">
                  {formatDisplayDate(kidding.kidDate)}
                </Text>
                <Text className="text-gray-500 text-[15px] mt-1">
                  {kidding.kidsBorn} born · {surviving} alive
                </Text>
              </View>
            );
          })}
        </Card>
      ) : null}

      <FarmWriteGate>
        <Button
          title="Edit Animal"
          variant="secondary"
          onPress={() => router.push(`/(tabs)/livestock/edit/${id}`)}
        />
      </FarmWriteGate>

      <Card>
        <Text className="text-xl font-extrabold text-ink mb-3">
          Health history
        </Text>
        {healthLoading ? (
          <Text className="text-gray-500">Loading health records…</Text>
        ) : (healthRows ?? []).length === 0 ? (
          <View>
            <Text className="text-gray-500 mb-3">
              No health events yet. Log vaccinations, FAMACHA, and treatments
              under More → Health Log.
            </Text>
            <FarmWriteGate>
              <Button
                title="Add Health Record"
                variant="outline"
                onPress={() =>
                  router.push({
                    pathname: '/(tabs)/more/health/add',
                    params: { animalId: animal.id },
                  })
                }
              />
            </FarmWriteGate>
          </View>
        ) : (
          (healthRows ?? []).map((row) => {
            const record = mapHealthRecord(row as Record<string, unknown>);
            return (
              <Pressable
                key={record.id}
                onPress={() =>
                  router.push(`/(tabs)/more/health/edit/${record.id}`)
                }
                className="min-h-[56px] justify-center py-2 border-b border-gray-100">
                <View className="flex-row justify-between items-start">
                  <Text className="text-[17px] text-ink font-bold">
                    {formatHealthRecordKind(record.kind)}
                  </Text>
                  <Text className="text-gray-500 text-[15px]">
                    {formatDisplayDate(record.date)}
                  </Text>
                </View>
                {record.kind === 'famacha' && record.famachaScore != null ? (
                  <Text className="text-gray-500 text-[15px] mt-1">
                    Score {record.famachaScore}
                  </Text>
                ) : null}
                {record.productName ? (
                  <Text className="text-gray-500 text-[15px] mt-1">
                    {record.productName}
                  </Text>
                ) : null}
              </Pressable>
            );
          })
        )}
      </Card>

      <Card>
        <Text className="text-xl font-extrabold text-ink mb-3">
          Weight history
        </Text>
        {weightsLoading ? (
          <Text className="text-gray-500">Loading weights…</Text>
        ) : weights.length === 0 ? (
          <Text className="text-gray-500">
            No weights recorded yet. Use Weigh Day to add entries.
          </Text>
        ) : (
          weights.map((row) => {
            const entry = row as {
              id: string;
              date: string;
              weigh_point: string;
              weight_value: number;
              weight_unit: string;
            };
            return (
              <Pressable
                key={entry.id}
                onPress={() =>
                  router.push(`/(tabs)/livestock/weight-log/${entry.id}`)
                }
                className="flex-row justify-between items-center min-h-[56px] py-2 border-b border-gray-100">
                <View>
                  <Text className="text-[17px] text-ink font-bold">{entry.date}</Text>
                  <Text className="text-gray-500 text-[15px] capitalize">
                    {entry.weigh_point.replace(/_/g, ' ')}
                  </Text>
                </View>
                <Text className="text-ink font-bold">
                  {entry.weight_value} {entry.weight_unit}
                </Text>
              </Pressable>
            );
          })
        )}
      </Card>
      </View>
    </ScrollView>
    <FarmWriteGate>
      <View
        className="absolute left-0 right-0 bottom-0 flex-row gap-2 bg-white border-t border-gray-200 px-5 pt-3.5"
        style={{ paddingBottom: Math.max(insets.bottom, 14) }}>
        {quickActions.map((action, index) => (
          <Pressable
            key={action.label}
            onPress={action.onPress}
            accessibilityRole="button"
            className={`flex-1 h-[60px] rounded-[18px] border-[2.5px] border-bloodline-600 items-center justify-center ${
              index === 1 ? 'bg-bloodline-600 active:bg-bloodline-700' : 'bg-white active:bg-bloodline-50'
            }`}>
            <Text
              className={`text-base font-extrabold ${
                index === 1 ? 'text-white' : 'text-bloodline-600'
              }`}>
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </FarmWriteGate>
    </View>
  );
}

function GoatName({
  name,
  tag,
  id,
}: {
  name: string | null | undefined;
  tag: string | null | undefined;
  id: string;
}) {
  const cleanName = name?.trim();
  const cleanTag = tag?.trim();
  return (
    <Text className="text-[17px] text-ink font-bold">
      {cleanName ?? ''}
      {cleanTag ? (
        <Text className="text-bloodline-600">
          {cleanName ? ' ' : ''}#{cleanTag}
        </Text>
      ) : null}
      {!cleanName && !cleanTag ? animalDisplayLabel({ name: null, tagNumber: null, id }) : ''}
    </Text>
  );
}

function DetailRow({
  label,
  value,
  capitalize = false,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <View className="flex-row justify-between gap-4">
      <Text className="text-[17px] text-gray-500">{label}</Text>
      <Text
        className={`flex-1 text-right text-[17px] text-ink font-bold ${capitalize ? 'capitalize' : ''}`}>
        {value}
      </Text>
    </View>
  );
}

function ParentLink({
  label,
  animalId,
  name,
  tagNumber,
}: {
  label: string;
  animalId: string;
  name: string;
  tagNumber: string | null;
}) {
  return (
    <View className="flex-row justify-between items-center gap-4 min-h-[48px]">
      <Text className="text-[17px] text-gray-500">{label}</Text>
      <Pressable
        onPress={() => router.push(`/(tabs)/livestock/${animalId}`)}
        accessibilityRole="button"
        className="min-h-[48px] justify-center">
        {name.trim() || tagNumber ? (
          <GoatName name={name} tag={tagNumber} id={animalId} />
        ) : (
          <Text className="text-[17px] text-bloodline-600 font-bold">View animal</Text>
        )}
      </Pressable>
    </View>
  );
}
