import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { pastureStatusLabel } from '@/components/land/PastureStatusBadge';
import { Button } from '@/components/ui/Button';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { FormKeyboardScreen } from '@/components/ui/FormKeyboardScreen';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { createPasture } from '@/lib/db/land';
import type { ForageType, PastureStatus } from '@/lib/types/land';
import { formatForageType } from '@/lib/ui/pasture-labels';
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

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

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
      <FormKeyboardScreen
        contentContainerClassName="px-5 pt-2 pb-6"
        footer={
          <Button
            className="min-h-[60px]"
            title={loading ? 'Saving…' : 'Save pasture'}
            onPress={handleSave}
            disabled={loading}
          />
        }>
        <FormMessage message={errorMessage} tone="error" />

        <Input
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="North paddock"
        />
        <Input
          label="Acres"
          optional
          value={acres}
          onChangeText={setAcres}
          placeholder="Optional"
          keyboardType="decimal-pad"
        />

        <View className="mb-4">
          <FieldLabel>Forage</FieldLabel>
          <ChipRow>
            {FORAGE_TYPES.map((option) => (
              <Chip
                key={option}
                label={cap(formatForageType(option))}
                selected={forageType === option}
                onPress={() => setForageType(option)}
              />
            ))}
          </ChipRow>
        </View>

        <View className="mb-4">
          <FieldLabel>Status</FieldLabel>
          <ChipRow>
            {PASTURE_STATUSES.map((option) => (
              <Chip
                key={option}
                label={pastureStatusLabel(option)}
                selected={status === option}
                onPress={() => setStatus(option)}
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
