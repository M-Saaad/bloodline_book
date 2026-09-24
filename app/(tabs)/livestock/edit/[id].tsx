import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { todayIso } from '@/lib/dates';
import { LoadingState } from '@/components/ui/LoadingState';
import {
  getAnimalById,
  getBreedsForFarm,
  updateAnimal,
} from '@/lib/db/animals';
import type { Animal, Breed } from '@/lib/types/animals';
import { useFarm } from '@/providers/FarmProvider';

const SEX_OPTIONS: Animal['sex'][] = ['female', 'male'];

const LIFECYCLE_OPTIONS: Animal['lifecycleStage'][] = [
  'kid',
  'weaned',
  'yearling',
  'breeding',
  'feeder',
  'market_ready',
  'adult',
];

const STATUS_OPTIONS: {
  value: Animal['status'];
  label: string;
}[] = [
  { value: 'active', label: 'Active' },
  { value: 'sold', label: 'Sold' },
  { value: 'died', label: 'Deceased' },
];

export default function EditAnimalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeFarm } = useFarm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [name, setName] = useState('');
  const [tagNumber, setTagNumber] = useState('');
  const [sex, setSex] = useState<Animal['sex']>('female');
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [breedId, setBreedId] = useState<string | null>(null);
  const [lifecycleStage, setLifecycleStage] =
    useState<Animal['lifecycleStage']>('kid');
  const [status, setStatus] = useState<Animal['status']>('active');
  const [notes, setNotes] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [outDate, setOutDate] = useState('');

  useEffect(() => {
    if (!activeFarm || !id) {
      return;
    }

    let cancelled = false;

    const farm = activeFarm;

    async function load() {
      setLoading(true);
      try {
        const [animal, farmBreeds] = await Promise.all([
          getAnimalById(id),
          getBreedsForFarm(farm.id, farm.segment),
        ]);

        if (cancelled) {
          return;
        }

        if (!animal) {
          setErrorMessage('Animal not found.');
          return;
        }

        setName(animal.name ?? '');
        setTagNumber(animal.tagNumber ?? '');
        setSex(animal.sex);
        setBreedId(animal.breedPrimaryId);
        setLifecycleStage(animal.lifecycleStage);
        setStatus(animal.status);
        setNotes(animal.notes ?? '');
        setDateOfBirth(animal.dateOfBirth ?? '');
        setOutDate(animal.outDate ?? todayIso());
        setBreeds(farmBreeds);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Could not load animal.',
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
  }, [activeFarm, id]);

  async function handleSave() {
    if (!id) {
      return;
    }

    setErrorMessage('');
    setSaving(true);

    try {
      const leavingHerd = status !== 'active';

      await updateAnimal(id, {
        name: name.trim() || null,
        tagNumber: tagNumber.trim() || null,
        sex,
        breedPrimaryId: breedId,
        lifecycleStage,
        status,
        notes: notes.trim() || null,
        dateOfBirth: dateOfBirth || null,
        outDate: leavingHerd ? outDate || todayIso() : null,
      });

      router.back();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not save changes.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!activeFarm || !id) {
    return null;
  }

  if (loading) {
    return <LoadingState message="Loading animal…" />;
  }

  return (
    <HandWriteBlocked>
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="p-4">
      <FormMessage message={errorMessage} tone="error" />

      <Input label="Name" value={name} onChangeText={setName} placeholder="Daisy" />
      <Input
        label="Tag number"
        value={tagNumber}
        onChangeText={setTagNumber}
        placeholder="A-101"
      />

      <Text className="text-sm font-medium text-gray-700 mb-2">Sex</Text>
      <View className="flex-row gap-2 mb-4">
        {SEX_OPTIONS.map((option) => (
          <Pressable
            key={option}
            onPress={() => setSex(option)}
            className={`flex-1 rounded-xl border px-3 py-3 items-center capitalize ${
              sex === option
                ? 'border-bloodline-600 bg-bloodline-50'
                : 'border-gray-300 bg-white'
            }`}>
            <Text
              className={`font-medium ${
                sex === option ? 'text-bloodline-700' : 'text-gray-700'
              }`}>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>

      {breeds.length > 0 && (
        <>
          <Text className="text-sm font-medium text-gray-700 mb-2">Breed</Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {breeds.map((breed) => (
              <Pressable
                key={breed.id}
                onPress={() => setBreedId(breed.id)}
                className={`rounded-full border px-3 py-1.5 ${
                  breedId === breed.id
                    ? 'border-bloodline-600 bg-bloodline-50'
                    : 'border-gray-300 bg-white'
                }`}>
                <Text
                  className={`text-sm ${
                    breedId === breed.id
                      ? 'text-bloodline-700 font-medium'
                      : 'text-gray-700'
                  }`}>
                  {breed.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Text className="text-sm font-medium text-gray-700 mb-2">
        Lifecycle stage
      </Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {LIFECYCLE_OPTIONS.map((stage) => (
          <Pressable
            key={stage}
            onPress={() => setLifecycleStage(stage)}
            className={`rounded-full border px-3 py-1.5 ${
              lifecycleStage === stage
                ? 'border-bloodline-600 bg-bloodline-50'
                : 'border-gray-300 bg-white'
            }`}>
            <Text
              className={`text-sm capitalize ${
                lifecycleStage === stage
                  ? 'text-bloodline-700 font-medium'
                  : 'text-gray-700'
              }`}>
              {stage.replace(/_/g, ' ')}
            </Text>
          </Pressable>
        ))}
      </View>

      <DateField
        label="Date of birth"
        value={dateOfBirth}
        onChange={setDateOfBirth}
        optional
        maximumDate={new Date()}
      />

      <Text className="text-sm font-medium text-gray-700 mb-2">Status</Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {STATUS_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => {
              setStatus(option.value);
              if (option.value !== 'active' && !outDate) {
                setOutDate(todayIso());
              }
            }}
            className={`rounded-full border px-3 py-1.5 ${
              status === option.value
                ? 'border-bloodline-600 bg-bloodline-50'
                : 'border-gray-300 bg-white'
            }`}>
            <Text
              className={`text-sm ${
                status === option.value
                  ? 'text-bloodline-700 font-medium'
                  : 'text-gray-700'
              }`}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {status !== 'active' ? (
        <DateField
          label="Out date"
          value={outDate}
          onChange={setOutDate}
          maximumDate={new Date()}
        />
      ) : null}

      <Input
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        placeholder="Optional notes"
      />

      <Button
        title={saving ? 'Saving…' : 'Save Changes'}
        onPress={handleSave}
        disabled={saving}
        className="mt-2"
      />
    </ScrollView>
    </HandWriteBlocked>
  );
}
