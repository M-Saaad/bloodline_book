import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { FormMessage } from '@/components/ui/FormMessage';
import { LoadingState } from '@/components/ui/LoadingState';
import {
  getGrazingRecordById,
  updateGrazingRecordDates,
} from '@/lib/db/land';
import { getAnimalById } from '@/lib/db/animals';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';

export default function EditGrazingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [animalLabel, setAnimalLabel] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hasEndDate, setHasEndDate] = useState(false);

  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const record = await getGrazingRecordById(id);
        if (cancelled || !record) {
          setErrorMessage('Grazing stay not found.');
          return;
        }
        setStartDate(record.startDate);
        setEndDate(record.endDate ?? '');
        setHasEndDate(record.endDate != null);
        const animal = await getAnimalById(record.animalId);
        setAnimalLabel(animal ? animalDisplayLabel(animal) : 'Animal');
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Could not load grazing stay.',
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
    setSaving(true);
    setErrorMessage('');
    try {
      await updateGrazingRecordDates(id, {
        startDate,
        endDate: hasEndDate && endDate ? endDate : null,
      });
      router.back();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not save grazing stay.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState message="Loading grazing stay…" />;
  }

  return (
    <HandWriteBlocked>
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerClassName="p-4">
        <FormMessage message={errorMessage} tone="error" />
        <Text className="text-gray-800 font-medium mb-4">{animalLabel}</Text>
        <DateField label="Start date" value={startDate} onChange={setStartDate} />
        {hasEndDate ? (
          <DateField label="End date" value={endDate} onChange={setEndDate} />
        ) : (
          <Text className="text-gray-500 mb-4">This stay is still open (no end date).</Text>
        )}
        <Button
          title={saving ? 'Saving…' : 'Save Changes'}
          onPress={handleSave}
          disabled={saving}
        />
      </ScrollView>
    </HandWriteBlocked>
  );
}
