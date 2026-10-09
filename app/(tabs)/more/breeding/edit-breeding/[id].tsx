import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { breedingStatusTone } from '@/components/breeding/status';
import { DeleteRecordButton } from '@/components/DeleteRecordButton';
import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { AnimalSelectField } from '@/components/ui/AnimalSelectField';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { DateField } from '@/components/ui/DateField';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { FormKeyboardScreen } from '@/components/ui/FormKeyboardScreen';
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
  formatBreedingStatus,
  formatDueWindowPhrase,
  isBreedingOpenForKidding,
} from '@/lib/domain/breeding';
import type { BreedingStatus, ConfirmMethod } from '@/lib/types/breeding';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';
import { confirmAction } from '@/lib/ui/confirm';
import { useFarm } from '@/providers/FarmProvider';
import { Text } from '@/components/ui/Text';

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
        sireId: sireExternalName.trim() ? undefined : sireId ?? undefined,
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
        <View className="flex-row items-center gap-3 mb-4">
          <Badge
            label={formatBreedingStatus(status as BreedingStatus)}
            tone={breedingStatusTone(status as BreedingStatus)}
          />
          {window ? (
            <Text className="text-base font-semibold text-gray-500 flex-1">
              {formatDueWindowPhrase(window.windowStart, window.windowEnd)}
            </Text>
          ) : null}
        </View>

        {canChangeOutcome ? (
          <View className="gap-2.5 mb-5">
            <Button
              title="Log kidding"
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/more/breeding/add-kidding',
                  params: { damId: damId ?? '', breedingId: id },
                })
              }
            />
            <Button
              title="Confirm pregnant"
              variant="secondary"
              onPress={() => {
                setShowConfirm((value) => !value);
                setShowLost(false);
              }}
            />
            {showConfirm ? (
              <Card>
                <DateField
                  label="Confirmed date"
                  value={confirmedDate}
                  onChange={setConfirmedDate}
                />
                <FieldLabel>Method</FieldLabel>
                <View className="mb-4">
                  <ChipRow>
                    {METHODS.map((method) => (
                      <Chip
                        key={method.value}
                        label={method.label}
                        selected={confirmMethod === method.value}
                        onPress={() => setConfirmMethod(method.value)}
                      />
                    ))}
                  </ChipRow>
                </View>
                <Button
                  title={saving ? 'Saving…' : 'Save confirmation'}
                  onPress={handleConfirm}
                  disabled={saving}
                />
              </Card>
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
              <Card>
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
              </Card>
            ) : null}
          </View>
        ) : null}

        <AnimalSelectField
          label="Dam"
          animals={females}
          value={damId}
          onChange={setDamId}
        />
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
        <Input label="Notes" value={notes} onChangeText={setNotes} optional multiline />
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
      </FormKeyboardScreen>
    </HandWriteBlocked>
  );
}
