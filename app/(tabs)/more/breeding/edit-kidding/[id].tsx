import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { DeleteRecordButton } from '@/components/DeleteRecordButton';
import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { AnimalSelectField } from '@/components/ui/AnimalSelectField';
import { Button } from '@/components/ui/Button';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { DateField } from '@/components/ui/DateField';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { FormKeyboardScreen } from '@/components/ui/FormKeyboardScreen';
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
import type { KiddingEase } from '@/lib/types/breeding';
import { kiddingDeleteKidsPrompt } from '@/lib/domain/kidding-delete';
import { confirmAction } from '@/lib/ui/confirm';
import { useFarm } from '@/providers/FarmProvider';
import { Text } from '@/components/ui/Text';

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
  const [kiddingEase, setKiddingEase] = useState<KiddingEase | null>(null);

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

  const { data: litterKidRows } = useQuery(
    id
      ? 'SELECT COUNT(*) as count FROM animals WHERE litter_id = ?'
      : 'SELECT 1 WHERE 0',
    id ? [id] : [],
  );

  const registeredKidCount = Number(
    (litterKidRows?.[0] as { count?: number } | undefined)?.count ?? 0,
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
        setKiddingEase(event.kiddingEase);
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
        sireId: sireExternalName.trim() ? undefined : sireId ?? undefined,
        sireExternalName: sireExternalName.trim() || undefined,
        kiddingEase,
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
      <FormKeyboardScreen
        contentContainerClassName="px-5 pt-2 pb-8"
        footer={
          <Button
            title={saving ? 'Saving…' : 'Save changes'}
            onPress={handleSave}
            disabled={saving}
            className="min-h-[60px]"
          />
        }>
        <FormMessage message={errorMessage} tone="error" />

        <DateField label="Kid date" value={kidDate} onChange={setKidDate} />
        <FieldLabel>How did it go?</FieldLabel>
        <View className="mb-4">
          <ChipRow>
            {(
              [
                ['unassisted', 'Unassisted'],
                ['assisted', 'Assisted'],
                ['vet', 'Vet'],
              ] as const
            ).map(([value, label]) => (
              <Chip
                key={value}
                label={label}
                selected={kiddingEase === value}
                onPress={() => setKiddingEase(value)}
              />
            ))}
          </ChipRow>
        </View>
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
          placeholder="Optional — defaults to kids born"
        />
        {registeredKidCount > 0 ? (
          <Text className="text-[15px] leading-5 text-gray-500 mb-4">
            {registeredKidCount} kid{registeredKidCount === 1 ? '' : 's'}{' '}
            registered in Livestock for this kidding. Saving updates that count
            to match surviving (or kids born if surviving is blank), and updates
            their birth date and sire. Kids with weight or health records are
            not removed automatically.
          </Text>
        ) : null}
        <AnimalSelectField
          label="Sire"
          animals={males}
          value={sireId}
          onChange={setSireId}
          externalLabel={sireExternalName}
          onExternalLabelChange={(label) => setSireExternalName(label ?? '')}
          allowClear
          allowUnknown
          allowOutside
          outsideSex="male"
          emptyMessage="No bucks on this farm yet. You can add one who is not in this herd."
        />
        <Input label="Notes" value={notes} onChangeText={setNotes} optional multiline />

        <DeleteRecordButton
          confirmTitle="Delete kidding?"
          confirmMessage="The linked breeding will return to bred status. You may be asked about registered kids."
          onDelete={handleDelete}
        />
      </FormKeyboardScreen>
    </HandWriteBlocked>
  );
}
