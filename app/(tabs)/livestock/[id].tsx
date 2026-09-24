import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View, Pressable } from 'react-native';

import { FarmWriteGate } from '@/components/FarmWriteGate';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { mapAnimal, mapHealthRecord, mapKiddingEvent } from '@/lib/db/mappers';
import { formatDisplayDate } from '@/lib/dates';
import { formatHealthRecordKind } from '@/lib/ui/health-labels';
import {
  animalDisplayLabel,
  formatAnimalStatus,
  formatLifecycleStage,
  formatRegistrationBody,
  statusBadgeTone,
} from '@/lib/ui/animal-labels';
import { useFarm } from '@/providers/FarmProvider';

export default function AnimalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeFarm } = useFarm();

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
      <View className="flex-1 bg-gray-50">
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

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="p-4 gap-4 pb-8">
      <Card>
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1 pr-3">
            <Text className="text-2xl font-bold text-gray-900">{displayName}</Text>
            {animal.tagNumber && animal.name ? (
              <Text className="text-gray-500 mt-1">Tag {animal.tagNumber}</Text>
            ) : null}
          </View>
          <Badge
            label={formatAnimalStatus(animal.status)}
            tone={statusBadgeTone(animal.status)}
          />
        </View>

        <View className="gap-2">
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
            <View className="mt-2 pt-2 border-t border-gray-100">
              <Text className="text-sm text-gray-500 mb-1">Notes</Text>
              <Text className="text-gray-800">{animal.notes}</Text>
            </View>
          ) : null}
        </View>
      </Card>

      <Card>
        <Text className="text-lg font-semibold text-gray-900 mb-3">Identity</Text>
        <View className="gap-2">
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
        <Text className="text-lg font-semibold text-gray-900 mb-3">Parents</Text>
        <View className="gap-2">
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
          <Text className="text-lg font-semibold text-gray-900 mb-3">
            Offspring
          </Text>
          {(offspringRows ?? []).map((row) => {
            const kid = mapAnimal(row as Record<string, unknown>);
            return (
              <Pressable
                key={kid.id}
                onPress={() => router.push(`/(tabs)/livestock/${kid.id}`)}
                className="py-2 border-b border-gray-100">
                <Text className="text-gray-900 font-medium">
                  {animalDisplayLabel(kid)}
                </Text>
                <Text className="text-gray-500 text-sm capitalize">
                  {kid.sex} · {formatLifecycleStage(kid.lifecycleStage)}
                </Text>
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      {animal.sex === 'female' && (kiddingRows ?? []).length > 0 ? (
        <Card>
          <Text className="text-lg font-semibold text-gray-900 mb-3">
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
                className="py-2 border-b border-gray-100">
                <Text className="text-gray-900 font-medium">
                  {formatDisplayDate(kidding.kidDate)}
                </Text>
                <Text className="text-gray-600 text-sm mt-1">
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
        <Text className="text-lg font-semibold text-gray-900 mb-3">
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
                onPress={() => router.push('/(tabs)/more/health/add')}
              />
            </FarmWriteGate>
          </View>
        ) : (
          (healthRows ?? []).map((row) => {
            const record = mapHealthRecord(row as Record<string, unknown>);
            return (
              <View
                key={record.id}
                className="py-2 border-b border-gray-100">
                <View className="flex-row justify-between items-start">
                  <Text className="text-gray-800 font-medium">
                    {formatHealthRecordKind(record.kind)}
                  </Text>
                  <Text className="text-gray-500 text-sm">
                    {formatDisplayDate(record.date)}
                  </Text>
                </View>
                {record.kind === 'famacha' && record.famachaScore != null ? (
                  <Text className="text-gray-600 text-sm mt-1">
                    Score {record.famachaScore}
                  </Text>
                ) : null}
                {record.productName ? (
                  <Text className="text-gray-600 text-sm mt-1">
                    {record.productName}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </Card>

      <Card>
        <Text className="text-lg font-semibold text-gray-900 mb-3">
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
              <View
                key={entry.id}
                className="flex-row justify-between items-center py-2 border-b border-gray-100">
                <View>
                  <Text className="text-gray-800 font-medium">{entry.date}</Text>
                  <Text className="text-gray-500 text-sm capitalize">
                    {entry.weigh_point.replace(/_/g, ' ')}
                  </Text>
                </View>
                <Text className="text-gray-900 font-semibold">
                  {entry.weight_value} {entry.weight_unit}
                </Text>
              </View>
            );
          })
        )}
      </Card>
    </ScrollView>
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
    <View className="flex-row justify-between">
      <Text className="text-gray-500">{label}</Text>
      <Text className={`text-gray-900 font-medium ${capitalize ? 'capitalize' : ''}`}>
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
  const display = name.trim()
    ? name
    : tagNumber
      ? `#${tagNumber}`
      : 'View animal';

  return (
    <View className="flex-row justify-between items-center">
      <Text className="text-gray-500">{label}</Text>
      <Pressable onPress={() => router.push(`/(tabs)/livestock/${animalId}`)}>
        <Text className="text-bloodline-700 font-medium">{display}</Text>
      </Pressable>
    </View>
  );
}
