import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { FormKeyboardScreen } from '@/components/ui/FormKeyboardScreen';
import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { Button } from '@/components/ui/Button';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { DateField } from '@/components/ui/DateField';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { todayIso } from '@/lib/dates';
import { createFeedLog } from '@/lib/db/land';
import { mapPasture } from '@/lib/db/mappers';
import type { FeedUnit } from '@/lib/types/land';
import { useFarm } from '@/providers/FarmProvider';

const FEED_SUGGESTIONS = ['Hay', 'Grain', 'Mineral', 'Pellets', 'Browse', 'Other'];
const FEED_UNITS: FeedUnit[] = ['lb', 'kg', 'bale', 'bag'];

export default function AddFeedScreen() {
  const { pastureId: pastureIdParam } = useLocalSearchParams<{
    pastureId?: string;
  }>();
  const { activeFarm } = useFarm();
  const [feedDate, setFeedDate] = useState(todayIso);
  const [feedType, setFeedType] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<FeedUnit>(
    activeFarm?.weightUnit === 'kg' ? 'kg' : 'lb',
  );
  const [pastureId, setPastureId] = useState<string | null>(
    pastureIdParam ?? null,
  );
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { data: pastureRows } = useQuery(
    activeFarm
      ? `SELECT * FROM pastures
         WHERE farm_id = ?
         ORDER BY name COLLATE NOCASE`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const pastures = useMemo(
    () => (pastureRows ?? []).map((row) => mapPasture(row as Record<string, unknown>)),
    [pastureRows],
  );

  async function handleSave() {
    if (!activeFarm) {
      return;
    }

    setErrorMessage('');
    if (!feedType.trim()) {
      setErrorMessage('Enter a feed type.');
      return;
    }

    let parsedQuantity: number | undefined;
    if (quantity.trim()) {
      parsedQuantity = Number.parseFloat(quantity);
      if (Number.isNaN(parsedQuantity) || parsedQuantity < 0) {
        setErrorMessage('Enter a valid quantity, or leave it blank.');
        return;
      }
    }

    setLoading(true);
    try {
      await createFeedLog(activeFarm.id, {
        date: feedDate,
        feedType: feedType.trim(),
        quantity: parsedQuantity,
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
      setLoading(false);
    }
  }

  if (!activeFarm) {
    return null;
  }

  return (
    <HandWriteBlocked>
      <FormKeyboardScreen
        contentContainerClassName="px-5 pt-2 pb-6"
        footer={
          <Button
            className="min-h-[60px]"
            title={loading ? 'Saving…' : 'Save feed'}
            onPress={handleSave}
            disabled={loading}
          />
        }>
        <FormMessage message={errorMessage} tone="error" />

        <DateField
          label="Date"
          value={feedDate}
          onChange={setFeedDate}
          maximumDate={new Date()}
        />

        <View className="mb-4">
          <FieldLabel>What did you feed?</FieldLabel>
          <ChipRow>
            {FEED_SUGGESTIONS.map((suggestion) => (
              <Chip
                key={suggestion}
                label={suggestion}
                selected={feedType === suggestion}
                onPress={() => setFeedType(suggestion)}
              />
            ))}
          </ChipRow>
        </View>

        <Input
          label="Feed type"
          hint="Tap a choice above, or type your own."
          value={feedType}
          onChangeText={setFeedType}
          placeholder="Hay"
        />

        <Input
          label="Amount"
          optional
          value={quantity}
          onChangeText={setQuantity}
          placeholder="Optional"
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

        <Input
          label="Notes"
          optional
          multiline
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional"
        />
      </FormKeyboardScreen>
    </HandWriteBlocked>
  );
}
