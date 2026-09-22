import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormMessage } from '@/components/ui/FormMessage';
import { LoadingState } from '@/components/ui/LoadingState';
import { formatDisplayDate, todayIso } from '@/lib/dates';
import { endGrazingRecords, updatePastureStatus } from '@/lib/db/land';
import { mapAnimal, mapFeedLog, mapGrazingRecord, mapPasture } from '@/lib/db/mappers';
import type { PastureStatus } from '@/lib/types/land';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';
import {
  formatForageType,
  formatPastureStatus,
  pastureStatusTone,
} from '@/lib/ui/pasture-labels';
import { useFarm } from '@/providers/FarmProvider';

const PASTURE_STATUSES: PastureStatus[] = [
  'resting',
  'grazing',
  'hay',
  'overgrazed',
];

export default function PastureDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeFarm } = useFarm();
  const [errorMessage, setErrorMessage] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [endingIds, setEndingIds] = useState<string[]>([]);

  const { data: pastureRows, isLoading: pastureLoading } = useQuery(
    id ? 'SELECT * FROM pastures WHERE id = ?' : 'SELECT 1 WHERE 0',
    id ? [id] : [],
  );

  const { data: grazingRows, isLoading: grazingLoading } = useQuery(
    id
      ? `SELECT * FROM grazing_records
         WHERE pasture_id = ?
         ORDER BY (end_date IS NULL) DESC, start_date DESC, created_at DESC`
      : 'SELECT 1 WHERE 0',
    id ? [id] : [],
  );

  const { data: animalRows } = useQuery(
    activeFarm
      ? `SELECT * FROM animals WHERE farm_id = ?`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const { data: feedRows } = useQuery(
    id
      ? `SELECT * FROM feed_logs
         WHERE pasture_id = ?
         ORDER BY date DESC, created_at DESC
         LIMIT 8`
      : 'SELECT 1 WHERE 0',
    id ? [id] : [],
  );

  const animalsById = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of animalRows ?? []) {
      const animal = mapAnimal(row as Record<string, unknown>);
      map.set(animal.id, animalDisplayLabel(animal));
    }
    return map;
  }, [animalRows]);

  if (!activeFarm || !id) {
    return null;
  }

  if (pastureLoading) {
    return <LoadingState message="Loading pasture…" />;
  }

  const pastureRow = pastureRows?.[0];
  if (!pastureRow) {
    return (
      <View className="flex-1 bg-gray-50">
        <EmptyState
          title="Pasture not found"
          description="This pasture may have been removed or is not on this farm."
          actionLabel="Back to Land"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const pasture = mapPasture(pastureRow as Record<string, unknown>);
  const grazingRecords = (grazingRows ?? []).map((row) =>
    mapGrazingRecord(row as Record<string, unknown>),
  );
  const openRecords = grazingRecords.filter((record) => record.endDate == null);
  const historyRecords = grazingRecords.filter((record) => record.endDate != null);
  const feedLogs = (feedRows ?? []).map((row) =>
    mapFeedLog(row as Record<string, unknown>),
  );

  async function handleStatus(next: PastureStatus) {
    setErrorMessage('');
    setUpdatingStatus(true);
    try {
      await updatePastureStatus(pasture.id, next);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not update status.',
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleMoveOut(recordId: string) {
    setErrorMessage('');
    setEndingIds((current) => [...current, recordId]);
    try {
      await endGrazingRecords([recordId], todayIso());
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not move animal out.',
      );
    } finally {
      setEndingIds((current) => current.filter((item) => item !== recordId));
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="p-4 gap-4 pb-8">
      <FormMessage message={errorMessage} tone="error" />

      <Card>
        <View className="flex-row justify-between items-start mb-3">
          <Text className="text-2xl font-bold text-gray-900 flex-1 pr-3">
            {pasture.name}
          </Text>
          <Badge
            label={formatPastureStatus(pasture.status)}
            tone={pastureStatusTone(pasture.status)}
          />
        </View>
        <Text className="text-gray-600 capitalize mb-3">
          {formatForageType(pasture.forageType)}
          {pasture.acres != null ? ` · ${pasture.acres} acres` : ''}
        </Text>
        {pasture.notes ? (
          <Text className="text-gray-800 mb-3">{pasture.notes}</Text>
        ) : null}
        <Text className="text-sm font-medium text-gray-700 mb-2">Status</Text>
        <View className="flex-row flex-wrap gap-2">
          {PASTURE_STATUSES.map((option) => (
            <Button
              key={option}
              title={formatPastureStatus(option)}
              variant={pasture.status === option ? 'primary' : 'outline'}
              disabled={updatingStatus}
              onPress={() => handleStatus(option)}
              className="px-3 py-2"
            />
          ))}
        </View>
      </Card>

      <View className="gap-2">
        <Button
          title="Move animals here"
          onPress={() =>
            router.push({
              pathname: '/(tabs)/land/add-grazing',
              params: { pastureId: pasture.id },
            })
          }
        />
        <Button
          title="Log feed here"
          variant="secondary"
          onPress={() =>
            router.push({
              pathname: '/(tabs)/land/add-feed',
              params: { pastureId: pasture.id },
            })
          }
        />
      </View>

      <Card>
        <Text className="text-lg font-semibold text-gray-900 mb-3">
          Currently grazing
        </Text>
        {grazingLoading ? (
          <Text className="text-gray-500">Loading occupancy…</Text>
        ) : openRecords.length === 0 ? (
          <Text className="text-gray-500">No animals on this pasture now.</Text>
        ) : (
          openRecords.map((record) => (
            <View
              key={record.id}
              className="flex-row justify-between items-center py-2 border-b border-gray-100">
              <View className="flex-1 pr-3">
                <Text className="text-gray-900 font-medium">
                  {animalsById.get(record.animalId) ?? 'Unknown animal'}
                </Text>
                <Text className="text-gray-500 text-sm">
                  Since {formatDisplayDate(record.startDate)}
                </Text>
              </View>
              <Button
                title={endingIds.includes(record.id) ? 'Moving…' : 'Move out'}
                variant="outline"
                disabled={endingIds.includes(record.id)}
                onPress={() => handleMoveOut(record.id)}
                className="px-3 py-2"
              />
            </View>
          ))
        )}
      </Card>

      <Card>
        <Text className="text-lg font-semibold text-gray-900 mb-3">
          Grazing history
        </Text>
        {historyRecords.length === 0 ? (
          <Text className="text-gray-500">No completed rotations yet.</Text>
        ) : (
          historyRecords.slice(0, 12).map((record) => (
            <View
              key={record.id}
              className="flex-row justify-between py-2 border-b border-gray-100">
              <Text className="text-gray-800 flex-1 pr-2">
                {animalsById.get(record.animalId) ?? 'Unknown animal'}
              </Text>
              <Text className="text-gray-500 text-sm">
                {formatDisplayDate(record.startDate)} –{' '}
                {record.endDate ? formatDisplayDate(record.endDate) : 'open'}
              </Text>
            </View>
          ))
        )}
      </Card>

      <Card>
        <Text className="text-lg font-semibold text-gray-900 mb-3">Feed here</Text>
        {feedLogs.length === 0 ? (
          <Text className="text-gray-500">No feed logs tied to this pasture.</Text>
        ) : (
          feedLogs.map((item) => (
            <View
              key={item.id}
              className="flex-row justify-between py-2 border-b border-gray-100">
              <View>
                <Text className="text-gray-900 font-medium">{item.feedType}</Text>
                <Text className="text-gray-500 text-sm">
                  {formatDisplayDate(item.date)}
                </Text>
              </View>
              <Text className="text-gray-700">
                {item.quantity != null
                  ? `${item.quantity} ${item.unit}`
                  : item.unit}
              </Text>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}
