import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { AnimalSelectField } from '@/components/ui/AnimalSelectField';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
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
import { animalDisplayLabel } from '@/lib/ui/animal-labels';
import { useFarm } from '@/providers/FarmProvider';

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
        sireId: sireId ?? undefined,
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
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerClassName="p-4 pb-10"
        keyboardShouldPersistTaps="handled">
        <FormMessage message={errorMessage} tone="error" />

        <AnimalSelectField
          label="Dam"
          animals={females}
          value={damId}
          onChange={setDamId}
          emptyMessage="Add active does on the Livestock tab first."
        />

        <Text className="text-sm font-medium text-gray-700 mb-2">
          Which breeding is this?
        </Text>
        <View className="gap-2 mb-4">
          {openBreedings.map((event) => {
            const selected = breedingId === event.id;
            return (
              <Pressable
                key={event.id}
                onPress={() => setBreedingId(event.id)}
                className={`rounded-xl border px-3 py-3 ${
                  selected
                    ? 'border-bloodline-600 bg-bloodline-50'
                    : 'border-gray-300 bg-white'
                }`}>
                <Text className="text-gray-900 font-medium capitalize">
                  {event.status} · {formatDisplayDate(event.bredDate)}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setBreedingId(null)}
            className={`rounded-xl border px-3 py-3 ${
              breedingId == null
                ? 'border-bloodline-600 bg-bloodline-50'
                : 'border-gray-300 bg-white'
            }`}>
            <Text className="text-gray-900 font-medium">Not recorded</Text>
          </Pressable>
        </View>

        <AnimalSelectField
          label="Sire (on farm)"
          animals={males}
          value={sireId}
          onChange={setSireId}
          emptyMessage="Optional — use external sire name below if off-farm."
        />
        <Input
          label="External sire name"
          value={sireExternalName}
          onChangeText={setSireExternalName}
          placeholder="Optional"
        />
        <DateField label="Kid date" value={kidDate} onChange={setKidDate} />

        <Text className="text-sm font-medium text-gray-700 mb-2">Kidding ease</Text>
        <View className="flex-row gap-2 mb-4">
          {EASE_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setEase(option.value)}
              className={`flex-1 rounded-xl border py-2 items-center ${
                ease === option.value
                  ? 'border-bloodline-600 bg-bloodline-50'
                  : 'border-gray-300 bg-white'
              }`}>
              <Text
                className={`text-sm ${
                  ease === option.value
                    ? 'text-bloodline-700 font-medium'
                    : 'text-gray-700'
                }`}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-sm font-medium text-gray-700">
            Kids born ({kids.length})
          </Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() =>
                setKids((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
              }
              className="rounded-full border border-gray-300 px-3 py-1">
              <Text className="text-gray-800">−</Text>
            </Pressable>
            <Pressable
              onPress={() => setKids((prev) => [...prev, emptyKid()])}
              className="rounded-full border border-gray-300 px-3 py-1">
              <Text className="text-gray-800">+</Text>
            </Pressable>
          </View>
        </View>
        <Text className="text-sm text-gray-500 mb-3">
          {aliveKidCount(kids)} alive at birth
        </Text>

        {kids.map((kid, index) => (
          <View
            key={index}
            className="bg-white border border-gray-200 rounded-xl p-3 mb-3">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Kid {index + 1}
            </Text>
            <View className="flex-row gap-2 mb-3">
              {(['female', 'male'] as const).map((sex) => (
                <Pressable
                  key={sex}
                  onPress={() => updateKid(index, { sex })}
                  className={`flex-1 rounded-lg border py-2 items-center ${
                    kid.sex === sex
                      ? 'border-bloodline-600 bg-bloodline-50'
                      : 'border-gray-300'
                  }`}>
                  <Text className="capitalize text-gray-800">{sex}</Text>
                </Pressable>
              ))}
            </View>
            <View className="flex-row gap-2 mb-3">
              {(['alive', 'dead'] as const).map((outcome) => (
                <Pressable
                  key={outcome}
                  onPress={() => updateKid(index, { outcome })}
                  className={`flex-1 rounded-lg border py-2 items-center ${
                    kid.outcome === outcome
                      ? 'border-bloodline-600 bg-bloodline-50'
                      : 'border-gray-300'
                  }`}>
                  <Text className="capitalize text-gray-800">
                    {outcome === 'alive' ? 'Born alive' : 'Born dead'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Input
              label="Name"
              value={kid.name}
              onChangeText={(value) => updateKid(index, { name: value })}
              placeholder={kidAnimalDefaultName(damLabel, index + 1, kidDate)}
            />
            <Input
              label="Tag"
              value={kid.tag}
              onChangeText={(value) => updateKid(index, { tag: value })}
              placeholder="Optional"
            />
            <Input
              label={`Birth weight (${activeFarm.weightUnit})`}
              value={kid.birthWeight}
              onChangeText={(value) => updateKid(index, { birthWeight: value })}
              keyboardType="decimal-pad"
              placeholder="Optional"
            />
          </View>
        ))}

        <Pressable
          onPress={() => setRegisterKids((value) => !value)}
          className="flex-row items-center gap-2 mb-4">
          <View
            className={`w-5 h-5 rounded border ${
              registerKids
                ? 'bg-bloodline-600 border-bloodline-600'
                : 'border-gray-400 bg-white'
            }`}
          />
          <Text className="text-gray-800">
            Register kids in herd (alive kids only)
          </Text>
        </Pressable>

        <Input
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional"
        />
        <Button
          title={loading ? 'Saving…' : 'Save Kidding'}
          onPress={handleSave}
          disabled={loading}
        />
      </ScrollView>
    </HandWriteBlocked>
  );
}
