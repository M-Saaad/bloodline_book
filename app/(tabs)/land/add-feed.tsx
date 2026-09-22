import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
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
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="p-4">
      <FormMessage message={errorMessage} tone="error" />

      <DateField
        label="Date"
        value={feedDate}
        onChange={setFeedDate}
        maximumDate={new Date()}
      />

      <Input
        label="Feed type"
        value={feedType}
        onChangeText={setFeedType}
        placeholder="Hay"
      />

      <Text className="text-sm font-medium text-gray-700 mb-2">Suggestions</Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {FEED_SUGGESTIONS.map((suggestion) => (
          <Pressable
            key={suggestion}
            onPress={() => setFeedType(suggestion)}
            className={`rounded-full border px-3 py-1.5 ${
              feedType === suggestion
                ? 'border-bloodline-600 bg-bloodline-50'
                : 'border-gray-300 bg-white'
            }`}>
            <Text
              className={`text-sm ${
                feedType === suggestion
                  ? 'text-bloodline-700 font-medium'
                  : 'text-gray-700'
              }`}>
              {suggestion}
            </Text>
          </Pressable>
        ))}
      </View>

      <Input
        label="Quantity"
        value={quantity}
        onChangeText={setQuantity}
        placeholder="Optional"
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
            <Text
              className={`text-sm ${
                unit === option
                  ? 'text-bloodline-700 font-medium'
                  : 'text-gray-700'
              }`}>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text className="text-sm font-medium text-gray-700 mb-2">
        Pasture (optional)
      </Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        <Pressable
          onPress={() => setPastureId(null)}
          className={`rounded-full border px-3 py-1.5 ${
            pastureId == null
              ? 'border-bloodline-600 bg-bloodline-50'
              : 'border-gray-300 bg-white'
          }`}>
          <Text
            className={`text-sm ${
              pastureId == null ? 'text-bloodline-700 font-medium' : 'text-gray-700'
            }`}>
            None
          </Text>
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
            <Text
              className={`text-sm ${
                pastureId === pasture.id
                  ? 'text-bloodline-700 font-medium'
                  : 'text-gray-700'
              }`}>
              {pasture.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <Input
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        placeholder="Optional"
      />

      <Button
        title={loading ? 'Saving…' : 'Save Feed Log'}
        onPress={handleSave}
        disabled={loading}
      />
    </ScrollView>
  );
}
