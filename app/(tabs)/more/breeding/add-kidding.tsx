import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { FormKeyboardScreen } from '@/components/ui/FormKeyboardScreen';
import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { AnimalSelectField } from '@/components/ui/AnimalSelectField';
import { Button } from '@/components/ui/Button';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { DateField } from '@/components/ui/DateField';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { Segmented } from '@/components/ui/Segmented';
import { formatDisplayDate, todayIso } from '@/lib/dates';
import {
  createKiddingEvent,
  getOpenBreedingsForDam,
  type KiddingKidDraft,
} from '@/lib/db/breeding';
import { mapAnimal } from '@/lib/db/mappers';
import { kidAnimalDefaultName } from '@/lib/domain/breeding';
import {
  aliveKidCount,
  parseBirthWeight,
  type KiddingEase,
  type KidOutcome,
} from '@/lib/domain/kidding';
import type { BreedingEvent } from '@/lib/types/breeding';
import { animalDisplayLabel, formatSex } from '@/lib/ui/animal-labels';
import { useFarm } from '@/providers/FarmProvider';
import { Text } from '@/components/ui/Text';

type KidRow = {
  sex: 'male' | 'female';
  outcome: KidOutcome;
  birthWeight: string;
  tag: string;
  name: string;
};

const EASE_OPTIONS: { value: KiddingEase; label: string }[] = [
  { value: 'unassisted', label: 'Unassisted' },
  { value: 'assisted', label: 'Assisted' },
  { value: 'vet', label: 'Vet' },
];

function emptyKid(): KidRow {
  return {
    sex: 'female',
    outcome: 'alive',
    birthWeight: '',
    tag: '',
    name: '',
  };
}

export default function AddKiddingScreen() {
  const params = useLocalSearchParams<{ damId?: string; breedingId?: string }>();
  const { activeFarm } = useFarm();
  const [damId, setDamId] = useState<string | null>(params.damId ?? null);
  const [breedingId, setBreedingId] = useState<string | null>(
    params.breedingId ?? null,
  );
  const [openBreedings, setOpenBreedings] = useState<BreedingEvent[]>([]);
  const [sireId, setSireId] = useState<string | null>(null);
  const [sireExternalName, setSireExternalName] = useState('');
  const [kidDate, setKidDate] = useState(todayIso());
  const [ease, setEase] = useState<KiddingEase | null>(null);
  const [kids, setKids] = useState<KidRow[]>([emptyKid()]);
  const [registerKids, setRegisterKids] = useState(true);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (typeof params.damId === 'string' && params.damId) {
      setDamId(params.damId);
    }
    if (typeof params.breedingId === 'string' && params.breedingId) {
      setBreedingId(params.breedingId);
    }
  }, [params.damId, params.breedingId]);

  const { data: animalRows } = useQuery(
    activeFarm
      ? `SELECT * FROM animals
         WHERE farm_id = ? AND status = 'active'
         ORDER BY COALESCE(name, tag_number, id)`
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

  const dam = females.find((animal) => animal.id === damId) ?? null;
  const damLabel = dam ? animalDisplayLabel(dam) : 'Dam';

  useEffect(() => {
    if (!activeFarm || !damId) {
      setOpenBreedings([]);
      return;
    }
    let cancelled = false;
    void getOpenBreedingsForDam(activeFarm.id, damId).then((rows) => {
      if (cancelled) {
        return;
      }
      setOpenBreedings(rows);
      setBreedingId((current) => {
        if (current && rows.some((row) => row.id === current)) {
          return current;
        }
        return rows[0]?.id ?? null;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [activeFarm, damId]);

  useEffect(() => {
    const selected = openBreedings.find((row) => row.id === breedingId);
    if (!selected) {
      return;
    }
    setSireId(selected.sireId);
    setSireExternalName(selected.sireExternalName ?? '');
  }, [breedingId, openBreedings]);

  function updateKid(index: number, patch: Partial<KidRow>) {
    setKids((prev) =>
      prev.map((kid, i) => (i === index ? { ...kid, ...patch } : kid)),
    );
  }

  async function handleSave() {
    if (!activeFarm) {
      return;
    }
    setErrorMessage('');
    if (!damId) {
      setErrorMessage('Select a dam.');
      return;
    }
    if (kids.length < 1) {
      setErrorMessage('Add at least one kid.');
      return;
    }

    const drafts: KiddingKidDraft[] = [];
    for (let index = 0; index < kids.length; index++) {
      const kid = kids[index];
      const weight = parseBirthWeight(kid.birthWeight);
      if (weight === 'invalid') {
        setErrorMessage('Enter a valid birth weight or leave it blank.');
        return;
      }
      drafts.push({
        sex: kid.sex,
        outcome: kid.outcome,
        name: kid.name.trim() || kidAnimalDefaultName(damLabel, index + 1, kidDate),
        tagNumber: kid.tag.trim() || undefined,
        birthWeight: weight,
      });
    }

    const alive = aliveKidCount(kids);
    setLoading(true);
    try {
      const kiddingId = await createKiddingEvent(activeFarm.id, {
        damId,
        sireId: sireExternalName.trim() ? undefined : sireId ?? undefined,
        sireExternalName: sireExternalName.trim() || undefined,
        kidDate,
        kidsBorn: kids.length,
        kidsSurviving: alive,
        kiddingEase: ease,
        notes: notes.trim() || undefined,
        damLabel,
        breedingEventId: breedingId,
        weaningDays: activeFarm.weaningDays,
        weightUnit: activeFarm.weightUnit,
        registerKids: registerKids
          ? drafts.filter((kid) => kid.outcome !== 'dead')
          : undefined,
      });
      router.replace(`/(tabs)/more/breeding/kidding/${kiddingId}`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not save kidding.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (!activeFarm) {
    return null;
  }

  return (
    <HandWriteBlocked>
      <FormKeyboardScreen
        contentContainerClassName="px-5 pt-2 pb-8"
        footer={
          <Button
            title={loading ? 'Saving…' : 'Save kidding'}
            onPress={handleSave}
            disabled={loading}
            className="min-h-[60px]"
          />
        }>
        <FormMessage message={errorMessage} tone="error" />

        <AnimalSelectField
          label="Dam"
          animals={females}
          value={damId}
          onChange={setDamId}
          emptyMessage="Add active does on the Livestock tab first."
        />

        <FieldLabel>Which breeding is this?</FieldLabel>
        <View className="mb-4">
          <ChipRow>
            {openBreedings.map((event) => (
              <Chip
                key={event.id}
                label={`${event.status.charAt(0).toUpperCase()}${event.status.slice(1)} · ${formatDisplayDate(event.bredDate)}`}
                selected={breedingId === event.id}
                onPress={() => setBreedingId(event.id)}
              />
            ))}
            <Chip
              label="Not recorded"
              selected={breedingId == null}
              onPress={() => setBreedingId(null)}
            />
          </ChipRow>
        </View>

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
        <DateField label="Kid date" value={kidDate} onChange={setKidDate} />

        <FieldLabel>How did it go?</FieldLabel>
        <View className="mb-4">
          <ChipRow>
            {EASE_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={ease === option.value}
                onPress={() => setEase(option.value)}
              />
            ))}
          </ChipRow>
        </View>

        <FieldLabel>How many kids?</FieldLabel>
        <View className="flex-row items-center justify-between bg-white border border-gray-300 rounded-[18px] p-1.5">
          <Pressable
            onPress={() =>
              setKids((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
            }
            accessibilityRole="button"
            accessibilityLabel="Fewer kids"
            className="w-[52px] h-[52px] rounded-full bg-bloodline-100 items-center justify-center active:bg-bloodline-200">
            <Text className="text-[28px] font-bold text-bloodline-900">−</Text>
          </Pressable>
          <Text className="text-2xl font-extrabold text-ink">
            {kids.length}{' '}
            <Text className="text-[17px] font-semibold text-gray-500">
              {kids.length === 1 ? 'kid born' : 'kids born'}
            </Text>
          </Text>
          <Pressable
            onPress={() => setKids((prev) => [...prev, emptyKid()])}
            accessibilityRole="button"
            accessibilityLabel="More kids"
            className="w-[52px] h-[52px] rounded-full bg-bloodline-100 items-center justify-center active:bg-bloodline-200">
            <Text className="text-[28px] font-bold text-bloodline-900">＋</Text>
          </Pressable>
        </View>
        <Text className="text-[15px] text-gray-500 mt-1.5 mb-4">
          {aliveKidCount(kids)} alive at birth
        </Text>

        {kids.map((kid, index) => (
          <View
            key={index}
            className="bg-white border border-gray-200 rounded-[22px] p-3.5 mb-3">
            <Text className="text-lg font-extrabold text-ink mb-2.5">
              Kid {index + 1}
            </Text>
            <Segmented
              value={kid.sex}
              onChange={(sex) => updateKid(index, { sex })}
              options={[
                { value: 'female', label: formatSex('female') },
                { value: 'male', label: formatSex('male') },
              ]}
            />
            <View className="mt-2.5">
              <Segmented
                value={kid.outcome}
                onChange={(outcome) => updateKid(index, { outcome })}
                options={[
                  { value: 'alive', label: 'Born alive' },
                  { value: 'dead', label: 'Born dead' },
                ]}
              />
            </View>
            <View className="flex-row gap-2.5 mt-2.5">
              <View className="flex-1">
                <Input
                  label="Name"
                  value={kid.name}
                  onChangeText={(value) => updateKid(index, { name: value })}
                  placeholder={kidAnimalDefaultName(damLabel, index + 1, kidDate)}
                />
              </View>
              <View className="flex-1">
                <Input
                  label={`Birth weight (${activeFarm.weightUnit})`}
                  value={kid.birthWeight}
                  onChangeText={(value) => updateKid(index, { birthWeight: value })}
                  keyboardType="decimal-pad"
                  placeholder="Optional"
                />
              </View>
            </View>
            <Input
              label="Tag"
              value={kid.tag}
              onChangeText={(value) => updateKid(index, { tag: value })}
              placeholder="Optional"
              optional
            />
          </View>
        ))}

        <Pressable
          onPress={() => setRegisterKids((value) => !value)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: registerKids }}
          className="flex-row items-center gap-3 min-h-[48px] mb-4">
          <View
            className={`w-8 h-8 rounded-[10px] items-center justify-center border-2 ${
              registerKids
                ? 'bg-bloodline-600 border-bloodline-600'
                : 'border-gray-300 bg-white'
            }`}>
            {registerKids ? (
              <Text className="text-white text-lg font-extrabold">✓</Text>
            ) : null}
          </View>
          <Text className="flex-1 text-[17px] font-semibold text-ink">
            Add alive kids to the herd
          </Text>
        </Pressable>

        <Input
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional"
          optional
          multiline
        />
      </FormKeyboardScreen>
    </HandWriteBlocked>
  );
}
