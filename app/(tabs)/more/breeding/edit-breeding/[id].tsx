import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { DeleteRecordButton } from '@/components/DeleteRecordButton';
import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { AnimalSelectField } from '@/components/ui/AnimalSelectField';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import { todayIso } from '@/lib/dates';
import {
  BreedingLinkedToKiddingError,
  confirmBreeding,
  deleteBreedingEvent,
  ensureBreedingDueTask,
  getBreedingEventById,
  markBreedingLost,
  markBreedingOpen,
  updateBreedingEvent,
} from '@/lib/db/breeding';
import { mapAnimal } from '@/lib/db/mappers';
import {
  computeBreedingWindow,
  formatDueWindowPhrase,
  isBreedingOpenForKidding,
} from '@/lib/domain/breeding';
import type { ConfirmMethod } from '@/lib/types/breeding';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';
import { confirmAction } from '@/lib/ui/confirm';
import { useFarm } from '@/providers/FarmProvider';

const METHODS: { value: ConfirmMethod; label: string }[] = [
  { value: 'ultrasound', label: 'Ultrasound' },
  { value: 'blood_test', label: 'Blood test' },
  { value: 'other', label: 'Other' },
];

export default function EditBreedingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeFarm } = useFarm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [status, setStatus] = useState<string>('bred');
  const [linkedKidding, setLinkedKidding] = useState(false);
  const [exposureEnd, setExposureEnd] = useState<string | null>(null);
  const [damId, setDamId] = useState<string | null>(null);
  const [sireId, setSireId] = useState<string | null>(null);
  const [sireExternalName, setSireExternalName] = useState('');
  const [bredDate, setBredDate] = useState('');
  const [notes, setNotes] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmedDate, setConfirmedDate] = useState(todayIso());
  const [confirmMethod, setConfirmMethod] = useState<ConfirmMethod | null>(
    null,
  );
  const [showLost, setShowLost] = useState(false);
  const [lostNote, setLostNote] = useState('');

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

  const gestationDays = activeFarm?.gestationDays ?? 150;
  const window = bredDate
    ? computeBreedingWindow({
        bredDate,
        exposureEndDate: exposureEnd,
        gestationDays,
      })
    : null;
  const canChangeOutcome =
    isBreedingOpenForKidding(status as 'bred') && !linkedKidding;

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
        setExposureEnd(event.exposureEndDate);
        setNotes(event.notes ?? '');
        setStatus(event.status);
        setLinkedKidding(event.kiddingEventId != null);
        setConfirmedDate(event.confirmedDate ?? todayIso());
        setConfirmMethod(event.confirmMethod);
        await ensureBreedingDueTask(id);
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
    setSaving(true);
    setErrorMessage('');
    try {
      await updateBreedingEvent(id, {
        damId,
        sireId: sireId ?? undefined,
        sireExternalName: sireExternalName.trim() || undefined,
        bredDate,
        exposureEndDate: exposureEnd,
        gestationDays,
        notes: notes.trim() || undefined,
        damLabel: dam ? animalDisplayLabel(dam) : 'Dam',
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

  async function handleConfirm() {
    if (!id || !confirmMethod) {
      setErrorMessage('Pick how pregnancy was confirmed.');
      return;
    }
    setSaving(true);
    setErrorMessage('');
    try {
      await confirmBreeding(id, {
        confirmedDate,
        method: confirmMethod,
      });
      setStatus('confirmed');
      setShowConfirm(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not confirm breeding.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleOpen() {
    if (!id) {
      return;
    }
    const confirmed = await confirmAction(
      'Mark open?',
      'She leaves the kidding calendar and the kidding task is closed.',
      'Mark open',
    );
    if (!confirmed) {
      return;
    }
    setSaving(true);
    try {
      await markBreedingOpen(id);
      setStatus('open');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not update breeding.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleLost() {
    if (!id) {
      return;
    }
    if (!lostNote.trim()) {
      setErrorMessage('Add a note for the loss.');
      return;
    }
    setSaving(true);
    setErrorMessage('');
    try {
      await markBreedingLost(id, lostNote.trim());
      setStatus('lost');
      setNotes((current) =>
        [current.trim(), lostNote.trim()].filter(Boolean).join('\n'),
      );
      setShowLost(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not update breeding.',
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
        contentContainerClassName="p-4"
        keyboardShouldPersistTaps="handled">
        <FormMessage message={errorMessage} tone="error" />
        <View className="flex-row items-center gap-2 mb-3">
          <Badge label={status} />
          {window ? (
            <Text className="text-sm text-gray-600 flex-1">
              {formatDueWindowPhrase(window.windowStart, window.windowEnd)}
            </Text>
          ) : null}
        </View>

        {canChangeOutcome ? (
          <View className="gap-2 mb-4">
            <Button
              title="Confirm pregnant"
              variant="secondary"
              onPress={() => {
                setShowConfirm((value) => !value);
                setShowLost(false);
              }}
            />
            {showConfirm ? (
              <View className="bg-white border border-gray-200 rounded-xl p-3">
                <DateField
                  label="Confirmed date"
                  value={confirmedDate}
                  onChange={setConfirmedDate}
                />
                <Text className="text-sm font-medium text-gray-700 mb-2">
                  Method
                </Text>
                <View className="flex-row flex-wrap gap-2 mb-3">
                  {METHODS.map((method) => (
                    <Pressable
                      key={method.value}
                      onPress={() => setConfirmMethod(method.value)}
                      className={`rounded-full border px-3 py-1.5 ${
                        confirmMethod === method.value
                          ? 'border-bloodline-600 bg-bloodline-50'
                          : 'border-gray-300 bg-white'
                      }`}>
                      <Text className="text-sm text-gray-800">{method.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Button
                  title={saving ? 'Saving…' : 'Save confirmation'}
                  onPress={handleConfirm}
                  disabled={saving}
                />
              </View>
            ) : null}
            <Button title="Mark open (not pregnant)" variant="outline" onPress={handleOpen} />
            <Button
              title="Mark lost"
              variant="outline"
              onPress={() => {
                setShowLost((value) => !value);
                setShowConfirm(false);
              }}
            />
            {showLost ? (
              <View className="bg-white border border-gray-200 rounded-xl p-3">
                <Input
                  label="What happened?"
                  value={lostNote}
                  onChangeText={setLostNote}
                  placeholder="Abortion or resorption"
                />
                <Button
                  title={saving ? 'Saving…' : 'Save loss'}
                  onPress={handleLost}
                  disabled={saving}
                />
              </View>
            ) : null}
            <Button
              title="Log kidding"
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/more/breeding/add-kidding',
                  params: { damId: damId ?? '', breedingId: id },
                })
              }
            />
          </View>
        ) : null}

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
        <DateField
          label={exposureEnd ? 'Exposure start' : 'Bred date'}
          value={bredDate}
          onChange={setBredDate}
        />
        {exposureEnd != null ? (
          <DateField
            label="Exposure end"
            value={exposureEnd}
            onChange={setExposureEnd}
          />
        ) : null}
        <Input label="Notes" value={notes} onChangeText={setNotes} />
        <Button
          title={saving ? 'Saving…' : 'Save Changes'}
          onPress={handleSave}
          disabled={saving}
        />
        <DeleteRecordButton
          confirmTitle="Delete breeding?"
          confirmMessage="The open kidding task will be removed."
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
