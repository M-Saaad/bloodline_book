import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { DeleteRecordButton } from '@/components/DeleteRecordButton';
import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormKeyboardScreen } from '@/components/ui/FormKeyboardScreen';
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
import { Text } from '@/components/ui/Text';

export default function EditWeightLogScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [weightValue, setWeightValue] = useState('');
  const [unit, setUnit] = useState('');
  const [animalLabel, setAnimalLabel] = useState('');
  const [animalName, setAnimalName] = useState<string | null>(null);
  const [animalTag, setAnimalTag] = useState<string | null>(null);

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
        setAnimalName(animal?.name?.trim() || null);
        setAnimalTag(animal?.tagNumber?.trim() || null);
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
      <FormKeyboardScreen
        contentContainerClassName="px-5 pt-3 pb-8"
        footer={
          <Button
            title={saving ? 'Saving…' : 'Save Changes'}
            onPress={handleSave}
            disabled={saving}
            className="min-h-[60px] rounded-[18px]"
          />
        }>
        <FormMessage message={errorMessage} tone="error" />
        <Card className="px-[18px] py-4 mb-4">
          <Text className="text-[15px] font-semibold text-gray-500">Goat</Text>
          <Text className="text-2xl font-extrabold text-ink">
            {animalName ?? (animalTag ? '' : animalLabel)}
            {animalTag ? (
              <Text className="text-bloodline-600">
                {animalName ? ' ' : ''}#{animalTag}
              </Text>
            ) : null}
          </Text>
        </Card>
        <Input
          label={`Weight (${unit})`}
          value={weightValue}
          onChangeText={setWeightValue}
          keyboardType="decimal-pad"
        />
        <DeleteRecordButton
          title="Delete this weight"
          confirmTitle="Delete weight?"
          confirmMessage="This weight entry will be removed. If it was the only entry in the session, the whole session will be deleted too."
          note="If it is the only weight in the session, the session is deleted too."
          onDelete={async () => {
            if (!id) {
              return;
            }
            await deleteWeightLog(id);
            router.back();
          }}
        />
      </FormKeyboardScreen>
    </HandWriteBlocked>
  );
}
