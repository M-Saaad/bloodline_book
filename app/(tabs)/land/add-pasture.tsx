import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { createPasture } from '@/lib/db/land';
import type { ForageType, PastureStatus } from '@/lib/types/land';
import { formatForageType, formatPastureStatus } from '@/lib/ui/pasture-labels';
import { useFarm } from '@/providers/FarmProvider';

const FORAGE_TYPES: ForageType[] = [
  'mixed',
  'bermuda',
  'clover',
  'browse',
  'hayfield',
  'other',
];

const PASTURE_STATUSES: PastureStatus[] = [
  'resting',
  'grazing',
  'hay',
  'overgrazed',
];

export default function AddPastureScreen() {
  const { activeFarm } = useFarm();
  const [name, setName] = useState('');
  const [acres, setAcres] = useState('');
  const [forageType, setForageType] = useState<ForageType>('mixed');
  const [status, setStatus] = useState<PastureStatus>('resting');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSave() {
    if (!activeFarm) {
      return;
    }

    setErrorMessage('');
    if (!name.trim()) {
      setErrorMessage('Enter a pasture name.');
      return;
    }

    let parsedAcres: number | undefined;
    if (acres.trim()) {
      parsedAcres = Number.parseFloat(acres);
      if (Number.isNaN(parsedAcres) || parsedAcres < 0) {
        setErrorMessage('Enter a valid acreage, or leave it blank.');
        return;
      }
    }

    setLoading(true);
    try {
      await createPasture(activeFarm.id, {
        name: name.trim(),
        acres: parsedAcres,
        forageType,
        status,
        notes: notes.trim() || undefined,
      });
      router.back();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not save pasture.',
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
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="p-4">
      <FormMessage message={errorMessage} tone="error" />

      <Input
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="North paddock"
      />
      <Input
        label="Acres"
        value={acres}
        onChangeText={setAcres}
        placeholder="Optional"
        keyboardType="decimal-pad"
      />

      <Text className="text-sm font-medium text-gray-700 mb-2">Forage</Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {FORAGE_TYPES.map((option) => (
          <Pressable
            key={option}
            onPress={() => setForageType(option)}
            className={`rounded-full border px-3 py-1.5 ${
              forageType === option
                ? 'border-bloodline-600 bg-bloodline-50'
                : 'border-gray-300 bg-white'
            }`}>
            <Text
              className={`text-sm capitalize ${
                forageType === option
                  ? 'text-bloodline-700 font-medium'
                  : 'text-gray-700'
              }`}>
              {formatForageType(option)}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text className="text-sm font-medium text-gray-700 mb-2">Status</Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {PASTURE_STATUSES.map((option) => (
          <Pressable
            key={option}
            onPress={() => setStatus(option)}
            className={`rounded-full border px-3 py-1.5 ${
              status === option
                ? 'border-bloodline-600 bg-bloodline-50'
                : 'border-gray-300 bg-white'
            }`}>
            <Text
              className={`text-sm capitalize ${
                status === option
                  ? 'text-bloodline-700 font-medium'
                  : 'text-gray-700'
              }`}>
              {formatPastureStatus(option)}
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
        title={loading ? 'Saving…' : 'Save Pasture'}
        onPress={handleSave}
        disabled={loading}
      />
    </ScrollView>
    </HandWriteBlocked>
  );
}
