import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Input } from '@/components/ui/Input';
import { BREED_PERCENTAGE_QUICK_PICKS } from '@/lib/domain/animals';
import type { Breed } from '@/lib/types/animals';

type AnimalBreedFieldsProps = {
  breeds: Breed[];
  breedId: string | null;
  onBreedIdChange: (value: string | null) => void;
  breedPercentage: string;
  onBreedPercentageChange: (value: string) => void;
  onCreateCustomBreed: (name: string) => Promise<string>;
};

export function AnimalBreedFields({
  breeds,
  breedId,
  onBreedIdChange,
  breedPercentage,
  onBreedPercentageChange,
  onCreateCustomBreed,
}: AnimalBreedFieldsProps) {
  const [showCustomBreed, setShowCustomBreed] = useState(false);
  const [customBreedName, setCustomBreedName] = useState('');
  const [creatingBreed, setCreatingBreed] = useState(false);
  const [breedError, setBreedError] = useState('');

  async function handleAddCustomBreed() {
    const trimmed = customBreedName.trim();
    if (!trimmed) {
      setBreedError('Enter a breed name.');
      return;
    }

    setBreedError('');
    setCreatingBreed(true);
    try {
      const newId = await onCreateCustomBreed(trimmed);
      onBreedIdChange(newId);
      setCustomBreedName('');
      setShowCustomBreed(false);
    } catch (error) {
      setBreedError(
        error instanceof Error ? error.message : 'Could not add breed.',
      );
    } finally {
      setCreatingBreed(false);
    }
  }

  return (
    <>
      <Text className="text-base font-semibold text-gray-900 mb-3 mt-2">
        Breed
      </Text>
      {breeds.length > 0 ? (
        <View className="flex-row flex-wrap gap-2 mb-3">
          {breeds.map((breed) => (
            <Pressable
              key={breed.id}
              onPress={() =>
                onBreedIdChange(breedId === breed.id ? null : breed.id)
              }
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
      ) : null}

      {!showCustomBreed ? (
        <Pressable
          onPress={() => setShowCustomBreed(true)}
          className="rounded-xl border border-dashed border-gray-300 px-3 py-3 mb-4">
          <Text className="text-bloodline-700 font-medium text-center">
            Other breed…
          </Text>
        </Pressable>
      ) : (
        <View className="mb-4">
          <Input
            label="Custom breed name"
            value={customBreedName}
            onChangeText={setCustomBreedName}
            placeholder="My cross"
          />
          {breedError ? (
            <Text className="text-sm text-red-700 mb-2">{breedError}</Text>
          ) : null}
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => {
                setShowCustomBreed(false);
                setCustomBreedName('');
                setBreedError('');
              }}
              className="flex-1 rounded-xl border border-gray-300 bg-white px-3 py-3 items-center">
              <Text className="text-gray-700 font-medium">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleAddCustomBreed}
              disabled={creatingBreed}
              className="flex-1 rounded-xl border border-bloodline-600 bg-bloodline-50 px-3 py-3 items-center">
              <Text className="text-bloodline-700 font-medium">
                {creatingBreed ? 'Adding…' : 'Add breed'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      <Text className="text-sm font-medium text-gray-700 mb-2">
        Breed percentage (optional)
      </Text>
      <View className="flex-row flex-wrap gap-2 mb-3">
        {BREED_PERCENTAGE_QUICK_PICKS.map((value) => (
          <Pressable
            key={value}
            onPress={() => onBreedPercentageChange(String(value))}
            className={`rounded-full border px-3 py-1.5 ${
              breedPercentage === String(value)
                ? 'border-bloodline-600 bg-bloodline-50'
                : 'border-gray-300 bg-white'
            }`}>
            <Text
              className={`text-sm ${
                breedPercentage === String(value)
                  ? 'text-bloodline-700 font-medium'
                  : 'text-gray-700'
              }`}>
              {value}%
            </Text>
          </Pressable>
        ))}
      </View>
      <Input
        label="Breed percentage"
        value={breedPercentage}
        onChangeText={onBreedPercentageChange}
        placeholder="Optional"
        keyboardType="decimal-pad"
      />
    </>
  );
}
