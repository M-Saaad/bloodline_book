import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { createAnimal, getBreedsForFarm } from '@/lib/db/animals';
import type { Animal, Breed } from '@/lib/types/animals';
import { useFarm } from '@/providers/FarmProvider';

const SEX_OPTIONS: Animal['sex'][] = ['female', 'male'];

export default function AddAnimalScreen() {
  const { activeFarm } = useFarm();
  const [name, setName] = useState('');
  const [tagNumber, setTagNumber] = useState('');
  const [sex, setSex] = useState<Animal['sex']>('female');
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [breedId, setBreedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!activeFarm) {
      return;
    }
    getBreedsForFarm(activeFarm.id, activeFarm.segment).then(setBreeds);
  }, [activeFarm]);

  async function handleSave() {
    if (!activeFarm) {
      return;
    }

    setErrorMessage('');
    setLoading(true);
    try {
      await createAnimal(activeFarm.id, {
        name: name.trim() || undefined,
        tagNumber: tagNumber.trim() || undefined,
        sex,
        breedPrimaryId: breedId ?? undefined,
      });
      router.back();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not save animal.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (!activeFarm) {
    return null;
  }

  return (
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
          <View className="flex-row flex-wrap gap-2 mb-6">
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

      <Button
        title={loading ? 'Saving…' : 'Save Animal'}
        onPress={handleSave}
        disabled={loading}
      />
    </ScrollView>
  );
}
