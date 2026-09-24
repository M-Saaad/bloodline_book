import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { DeleteRecordButton } from '@/components/DeleteRecordButton';
import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import {
  deleteWeightLog,
  getWeightLogById,
  updateWeightLog,
} from '@/lib/db/weights';
import { getAnimalById } from '@/lib/db/animals';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';

export default function EditWeightLogScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [weightValue, setWeightValue] = useState('');
  const [unit, setUnit] = useState('');
  const [animalLabel, setAnimalLabel] = useState('');

  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const log = await getWeightLogById(id);
        if (cancelled || !log) {
          if (!log) {
            setErrorMessage('Weight entry not found.');
          }
          return;
        }
        setWeightValue(String(log.weightValue));
        setUnit(log.weightUnit);
        const animal = await getAnimalById(log.animalId);
        setAnimalLabel(animal ? animalDisplayLabel(animal) : 'Animal');
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Could not load weight.',
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
    if (!id) {
      return;
    }
    const parsed = Number.parseFloat(weightValue);
    if (Number.isNaN(parsed) || parsed <= 0) {
      setErrorMessage('Enter a valid weight.');
      return;
    }

    setSaving(true);
    setErrorMessage('');
    try {
      await updateWeightLog(id, parsed);
      router.back();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not save weight.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState message="Loading weight…" />;
  }

  return (
    <HandWriteBlocked>
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerClassName="p-4">
        <FormMessage message={errorMessage} tone="error" />
        <Text className="text-gray-600 mb-4">{animalLabel}</Text>
        <Input
          label={`Weight (${unit})`}
          value={weightValue}
          onChangeText={setWeightValue}
          keyboardType="decimal-pad"
        />
        <Button
          title={saving ? 'Saving…' : 'Save Changes'}
          onPress={handleSave}
          disabled={saving}
        />
        <DeleteRecordButton
          confirmTitle="Delete weight?"
          confirmMessage="This weight entry will be removed. If it was the only entry in the session, the whole session will be deleted too."
          onDelete={async () => {
            if (!id) {
              return;
            }
            await deleteWeightLog(id);
            router.back();
          }}
        />
      </ScrollView>
    </HandWriteBlocked>
  );
}
