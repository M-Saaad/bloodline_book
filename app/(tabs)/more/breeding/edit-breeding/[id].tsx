import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { DeleteRecordButton } from '@/components/DeleteRecordButton';
import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { AnimalSelectField } from '@/components/ui/AnimalSelectField';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import {
  addDaysToIso,
  GOAT_GESTATION_DAYS,
} from '@/lib/dates';
import {
  BreedingLinkedToKiddingError,
  deleteBreedingEvent,
  getBreedingEventById,
  updateBreedingEvent,
} from '@/lib/db/breeding';
import { mapAnimal } from '@/lib/db/mappers';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';
import { useFarm } from '@/providers/FarmProvider';

export default function EditBreedingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeFarm } = useFarm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [linkedKidding, setLinkedKidding] = useState(false);
  const [damId, setDamId] = useState<string | null>(null);
  const [sireId, setSireId] = useState<string | null>(null);
  const [sireExternalName, setSireExternalName] = useState('');
  const [bredDate, setBredDate] = useState('');
  const [notes, setNotes] = useState('');

  const { data: animalRows } = useQuery(
    activeFarm
      ? `SELECT * FROM animals WHERE farm_id = ? AND status = 'active'`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const animals = useMemo(
    () => (animalRows ?? []).map((row) => mapAnimal(row as Record<string, unknown>)),
    [animalRows],
  );
  const females = useMemo(
    () => animals.filter((animal) => animal.sex === 'female'),
    [animals],
  );
  const males = useMemo(
    () => animals.filter((animal) => animal.sex === 'male'),
    [animals],
  );

  const estimatedDue = addDaysToIso(bredDate, GOAT_GESTATION_DAYS);

  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const event = await getBreedingEventById(id);
        if (cancelled || !event) {
          setErrorMessage('Breeding record not found.');
          return;
        }
        setDamId(event.damId);
        setSireId(event.sireId);
        setSireExternalName(event.sireExternalName ?? '');
        setBredDate(event.bredDate);
        setNotes(event.notes ?? '');
        setLinkedKidding(event.kiddingEventId != null);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Could not load breeding.',
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
    if (!id || !damId) {
      setErrorMessage('Select a dam.');
      return;
    }
    const dam = females.find((animal) => animal.id === damId);
    const damLabel = dam ? animalDisplayLabel(dam) : 'Dam';

    setSaving(true);
    setErrorMessage('');
    try {
      await updateBreedingEvent(id, {
        damId,
        sireId: sireId ?? undefined,
        sireExternalName: sireExternalName.trim() || undefined,
        bredDate,
        notes: notes.trim() || undefined,
        damLabel,
      });
      router.back();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not save breeding.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!activeFarm || !id) {
    return null;
  }

  if (loading) {
    return <LoadingState message="Loading breeding…" />;
  }

  return (
    <HandWriteBlocked>
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerClassName="p-4">
        <FormMessage message={errorMessage} tone="error" />

        <AnimalSelectField
          label="Dam"
          animals={females}
          value={damId}
          onChange={setDamId}
        />
        <AnimalSelectField
          label="Sire (on farm)"
          animals={males}
          value={sireId}
          onChange={setSireId}
        />
        <Input
          label="External sire name"
          value={sireExternalName}
          onChangeText={setSireExternalName}
        />
        <DateField label="Bred date" value={bredDate} onChange={setBredDate} />
        {estimatedDue ? (
          <Text className="text-sm text-gray-600 mb-4">
            Estimated due: {estimatedDue}
          </Text>
        ) : null}
        <Input label="Notes" value={notes} onChangeText={setNotes} />

        <Button
          title={saving ? 'Saving…' : 'Save Changes'}
          onPress={handleSave}
          disabled={saving}
        />

        <DeleteRecordButton
          confirmTitle="Delete breeding?"
          confirmMessage="The open expected kidding task will be removed."
          disabled={linkedKidding}
          disabledReason={
            linkedKidding
              ? 'This breeding is linked to a kidding. Delete the kidding first.'
              : undefined
          }
          onDelete={async () => {
            try {
              await deleteBreedingEvent(id);
              router.back();
            } catch (error) {
              if (error instanceof BreedingLinkedToKiddingError) {
                setErrorMessage(error.message);
              } else {
                throw error;
              }
            }
          }}
        />
      </ScrollView>
    </HandWriteBlocked>
  );
}
