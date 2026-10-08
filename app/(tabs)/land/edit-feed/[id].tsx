import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { DeleteRecordButton } from '@/components/DeleteRecordButton';
import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { Button } from '@/components/ui/Button';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { FormKeyboardScreen } from '@/components/ui/FormKeyboardScreen';
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
      <FormKeyboardScreen
        contentContainerClassName="px-5 pt-2 pb-6"
        footer={
          <Button
            className="min-h-[60px]"
            title={saving ? 'Saving…' : 'Save changes'}
            onPress={handleSave}
            disabled={saving}
          />
        }>
        <FormMessage message={errorMessage} tone="error" />
        <DateField label="Date" value={feedDate} onChange={setFeedDate} />
        <Input label="Feed type" value={feedType} onChangeText={setFeedType} />
        <Input
          label="Amount"
          optional
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="decimal-pad"
        />
        <View className="mb-4">
          <FieldLabel>Unit</FieldLabel>
          <ChipRow>
            {FEED_UNITS.map((option) => (
              <Chip
                key={option}
                label={option}
                selected={unit === option}
                onPress={() => setUnit(option)}
              />
            ))}
          </ChipRow>
        </View>
        <View className="mb-4">
          <FieldLabel optional>Pasture</FieldLabel>
          <ChipRow>
            <Chip label="None" selected={pastureId == null} onPress={() => setPastureId(null)} />
            {pastures.map((pasture) => (
              <Chip
                key={pasture.id}
                label={pasture.name}
                selected={pastureId === pasture.id}
                onPress={() => setPastureId(pasture.id)}
              />
            ))}
          </ChipRow>
        </View>
        <Input label="Notes" optional multiline value={notes} onChangeText={setNotes} />
        <DeleteRecordButton
          confirmTitle="Delete feed log?"
          confirmMessage="This feed entry will be permanently removed."
          onDelete={async () => {
            await deleteFeedLog(id);
            router.back();
          }}
        />
      </FormKeyboardScreen>
    </HandWriteBlocked>
  );
}
