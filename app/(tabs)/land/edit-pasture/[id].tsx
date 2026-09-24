import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { Button } from '@/components/ui/Button';
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
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerClassName="p-4">
        <FormMessage message={errorMessage} tone="error" />
        <Input label="Name" value={name} onChangeText={setName} />
        <Input
          label="Acres"
          value={acres}
          onChangeText={setAcres}
          keyboardType="decimal-pad"
        />
        <Text className="text-sm font-medium text-gray-700 mb-2">Forage</Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {FORAGE_TYPES.map((type) => (
            <Pressable
              key={type}
              onPress={() => setForageType(type)}
              className={`rounded-full border px-3 py-1.5 ${
                forageType === type
                  ? 'border-bloodline-600 bg-bloodline-50'
                  : 'border-gray-300 bg-white'
              }`}>
              <Text className="text-sm">{formatForageType(type)}</Text>
            </Pressable>
          ))}
        </View>
        <Input label="Notes" value={notes} onChangeText={setNotes} />
        <Button
          title={saving ? 'Saving…' : 'Save Changes'}
          onPress={handleSave}
          disabled={saving}
        />
      </ScrollView>
    </HandWriteBlocked>
  );
}
