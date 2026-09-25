import { useMemo, useState } from 'react';
import { TextInput } from 'react-native';

import { animalMatchesSearch } from '@/lib/domain/animals';
import type { Animal } from '@/lib/types/animals';

export function useAnimalSearch(animals: Animal[]) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => animals.filter((animal) => animalMatchesSearch(animal, query)),
    [animals, query],
  );
  return { query, setQuery, filtered };
}

export function AnimalSearchField({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder="Search by name or tag"
      autoCapitalize="none"
      autoCorrect={false}
      clearButtonMode="while-editing"
      className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-white text-gray-900 mb-2"
      placeholderTextColor="#9ca3af"
    />
  );
}
