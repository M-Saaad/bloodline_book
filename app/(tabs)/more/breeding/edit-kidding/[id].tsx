import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView } from 'react-native';

import { DeleteRecordButton } from '@/components/DeleteRecordButton';
import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { AnimalSelectField } from '@/components/ui/AnimalSelectField';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import {
  deleteKiddingEvent,
  getKiddingEventById,
  getKidsForKidding,
  updateKiddingEvent,
} from '@/lib/db/breeding';
import { mapAnimal } from '@/lib/db/mappers';
import { validateKiddingCounts } from '@/lib/domain/breeding';
import { kiddingDeleteKidsPrompt } from '@/lib/domain/kidding-delete';
import { confirmAction } from '@/lib/ui/confirm';
import { useFarm } from '@/providers/FarmProvider';

export default function EditKiddingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeFarm } = useFarm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [sireId, setSireId] = useState<string | null>(null);
  const [sireExternalName, setSireExternalName] = useState('');
  const [kidDate, setKidDate] = useState('');
  const [kidsBorn, setKidsBorn] = useState('1');
  const [kidsSurviving, setKidsSurviving] = useState('');
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
  const males = useMemo(
    () => animals.filter((animal) => animal.sex === 'male'),
    [animals],
  );

  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const event = await getKiddingEventById(id);
        if (cancelled || !event) {
          setErrorMessage('Kidding record not found.');
          return;
        }
        setSireId(event.sireId);
        setSireExternalName(event.sireExternalName ?? '');
        setKidDate(event.kidDate);
        setKidsBorn(String(event.kidsBorn));
        setKidsSurviving(
          event.kidsSurviving != null ? String(event.kidsSurviving) : '',
        );
        setNotes(event.notes ?? '');
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Could not load kidding.',
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
    const born = Number.parseInt(kidsBorn, 10);
    let surviving: number | undefined;
    if (kidsSurviving.trim()) {
      surviving = Number.parseInt(kidsSurviving, 10);
    }
    const countError = validateKiddingCounts(born, surviving);
    if (countError) {
      setErrorMessage(countError);
      return;
    }

    setSaving(true);
    setErrorMessage('');
    try {
      await updateKiddingEvent(id, {
        kidDate,
        kidsBorn: born,
        kidsSurviving: surviving,
        sireId: sireId ?? undefined,
        sireExternalName: sireExternalName.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      router.back();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not save kidding.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id) {
      return;
    }
    const kids = await getKidsForKidding(id);
    const kidsPrompt = kiddingDeleteKidsPrompt(kids);
    let deleteRegisteredKids = false;
    if (kidsPrompt) {
      deleteRegisteredKids = await confirmAction(
        'Delete registered kids?',
        kidsPrompt,
        'Delete kids',
      );
    }
    await deleteKiddingEvent(id, { deleteRegisteredKids });
    router.back();
  }

  if (!activeFarm || !id) {
    return null;
  }

  if (loading) {
    return <LoadingState message="Loading kidding…" />;
  }

  return (
    <HandWriteBlocked>
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerClassName="p-4">
        <FormMessage message={errorMessage} tone="error" />

        <DateField label="Kid date" value={kidDate} onChange={setKidDate} />
        <Input
          label="Kids born"
          value={kidsBorn}
          onChangeText={setKidsBorn}
          keyboardType="numeric"
        />
        <Input
          label="Kids surviving"
          value={kidsSurviving}
          onChangeText={setKidsSurviving}
          keyboardType="numeric"
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
        <Input label="Notes" value={notes} onChangeText={setNotes} />

        <Button
          title={saving ? 'Saving…' : 'Save Changes'}
          onPress={handleSave}
          disabled={saving}
        />

        <DeleteRecordButton
          confirmTitle="Delete kidding?"
          confirmMessage="The linked breeding will return to bred status. You may be asked about registered kids."
          onDelete={handleDelete}
        />
      </ScrollView>
    </HandWriteBlocked>
  );
}
