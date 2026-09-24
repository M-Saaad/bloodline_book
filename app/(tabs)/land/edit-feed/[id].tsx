import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { DeleteRecordButton } from '@/components/DeleteRecordButton';
import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import {
  deleteFeedLog,
  getFeedLogById,
  updateFeedLog,
} from '@/lib/db/land';
import { mapPasture } from '@/lib/db/mappers';
import type { FeedUnit } from '@/lib/types/land';
import { useFarm } from '@/providers/FarmProvider';

const FEED_UNITS: FeedUnit[] = ['lb', 'kg', 'bale', 'bag'];

export default function EditFeedLogScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeFarm } = useFarm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [feedDate, setFeedDate] = useState('');
  const [feedType, setFeedType] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<FeedUnit>('lb');
  const [pastureId, setPastureId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const { data: pastureRows } = useQuery(
    activeFarm
      ? `SELECT * FROM pastures WHERE farm_id = ? ORDER BY name`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const pastures = useMemo(
    () => (pastureRows ?? []).map((row) => mapPasture(row as Record<string, unknown>)),
    [pastureRows],
  );

  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const log = await getFeedLogById(id);
        if (cancelled || !log) {
          setErrorMessage('Feed log not found.');
          return;
        }
        setFeedDate(log.date);
        setFeedType(log.feedType);
        setQuantity(log.quantity != null ? String(log.quantity) : '');
        setUnit(log.unit);
        setPastureId(log.pastureId);
        setNotes(log.notes ?? '');
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Could not load feed log.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSave() {
    if (!id || !feedType.trim()) {
      setErrorMessage('Enter a feed type.');
      return;
    }
    let parsedQty: number | undefined;
    if (quantity.trim()) {
      parsedQty = Number.parseFloat(quantity);
      if (Number.isNaN(parsedQty) || parsedQty < 0) {
        setErrorMessage('Enter a valid quantity.');
        return;
      }
    }

    setSaving(true);
    setErrorMessage('');
    try {
      await updateFeedLog(id, {
        date: feedDate,
        feedType: feedType.trim(),
        quantity: parsedQty,
        unit,
        pastureId: pastureId ?? undefined,
        notes: notes.trim() || undefined,
      });
      router.back();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not save feed log.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!activeFarm || !id) {
    return null;
  }

  if (loading) {
    return <LoadingState message="Loading feed log…" />;
  }

  return (
    <HandWriteBlocked>
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerClassName="p-4">
        <FormMessage message={errorMessage} tone="error" />
        <DateField label="Date" value={feedDate} onChange={setFeedDate} />
        <Input label="Feed type" value={feedType} onChangeText={setFeedType} />
        <Input
          label="Quantity"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="decimal-pad"
        />
        <Text className="text-sm font-medium text-gray-700 mb-2">Unit</Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {FEED_UNITS.map((option) => (
            <Pressable
              key={option}
              onPress={() => setUnit(option)}
              className={`rounded-full border px-3 py-1.5 ${
                unit === option
                  ? 'border-bloodline-600 bg-bloodline-50'
                  : 'border-gray-300 bg-white'
              }`}>
              <Text className="text-sm">{option}</Text>
            </Pressable>
          ))}
        </View>
        <Text className="text-sm font-medium text-gray-700 mb-2">Pasture</Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          <Pressable
            onPress={() => setPastureId(null)}
            className={`rounded-full border px-3 py-1.5 ${
              pastureId == null
                ? 'border-bloodline-600 bg-bloodline-50'
                : 'border-gray-300 bg-white'
            }`}>
            <Text className="text-sm">None</Text>
          </Pressable>
          {pastures.map((pasture) => (
            <Pressable
              key={pasture.id}
              onPress={() => setPastureId(pasture.id)}
              className={`rounded-full border px-3 py-1.5 ${
                pastureId === pasture.id
                  ? 'border-bloodline-600 bg-bloodline-50'
                  : 'border-gray-300 bg-white'
              }`}>
              <Text className="text-sm">{pasture.name}</Text>
            </Pressable>
          ))}
        </View>
        <Input label="Notes" value={notes} onChangeText={setNotes} />
        <Button
          title={saving ? 'Saving…' : 'Save Changes'}
          onPress={handleSave}
          disabled={saving}
        />
        <DeleteRecordButton
          confirmTitle="Delete feed log?"
          confirmMessage="This feed entry will be permanently removed."
          onDelete={async () => {
            await deleteFeedLog(id);
            router.back();
          }}
        />
      </ScrollView>
    </HandWriteBlocked>
  );
}
