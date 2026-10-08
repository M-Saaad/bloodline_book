import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { Button } from '@/components/ui/Button';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { FormKeyboardScreen } from '@/components/ui/FormKeyboardScreen';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import { getPastureById, updatePasture } from '@/lib/db/land';
import type { ForageType } from '@/lib/types/land';
import { formatForageType } from '@/lib/ui/pasture-labels';

const FORAGE_TYPES: ForageType[] = [
  'mixed',
  'bermuda',
  'clover',
  'browse',
  'hayfield',
  'other',
];

export default function EditPastureScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [name, setName] = useState('');
  const [acres, setAcres] = useState('');
  const [forageType, setForageType] = useState<ForageType>('mixed');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const pasture = await getPastureById(id);
        if (cancelled || !pasture) {
          setErrorMessage('Pasture not found.');
          return;
        }
        setName(pasture.name);
        setAcres(pasture.acres != null ? String(pasture.acres) : '');
        setForageType(pasture.forageType);
        setNotes(pasture.notes ?? '');
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Could not load pasture.',
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
    if (!id || !name.trim()) {
      setErrorMessage('Enter a pasture name.');
      return;
    }
    let parsedAcres: number | undefined;
    if (acres.trim()) {
      parsedAcres = Number.parseFloat(acres);
      if (Number.isNaN(parsedAcres) || parsedAcres < 0) {
        setErrorMessage('Enter valid acreage or leave blank.');
        return;
      }
    }

    setSaving(true);
    setErrorMessage('');
    try {
      await updatePasture(id, {
        name: name.trim(),
        acres: parsedAcres,
        forageType,
        notes: notes.trim() || undefined,
      });
      router.back();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not save pasture.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState message="Loading pasture…" />;
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
        <Input label="Name" value={name} onChangeText={setName} />
        <Input
          label="Acres"
          optional
          value={acres}
          onChangeText={setAcres}
          keyboardType="decimal-pad"
        />
        <View className="mb-4">
          <FieldLabel>Forage</FieldLabel>
          <ChipRow>
            {FORAGE_TYPES.map((type) => (
              <Chip
                key={type}
                label={formatForageType(type).charAt(0).toUpperCase() + formatForageType(type).slice(1)}
                selected={forageType === type}
                onPress={() => setForageType(type)}
              />
            ))}
          </ChipRow>
        </View>
        <Input label="Notes" optional multiline value={notes} onChangeText={setNotes} />
      </FormKeyboardScreen>
    </HandWriteBlocked>
  );
}
