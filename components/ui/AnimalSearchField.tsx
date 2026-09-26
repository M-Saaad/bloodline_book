import { useMemo, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { animalMatchesSearch, rememberAnimals } from '@/lib/domain/animals';
import type { Animal } from '@/lib/types/animals';

export function useAnimalSearch(animals: Animal[]) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => animals.filter((animal) => animalMatchesSearch(animal, query)),
    [animals, query],
  );
  return { query, setQuery, filtered };
}

/** Keep the last non-empty herd so a brief empty query does not remove the search list. */
export function useRememberedAnimals(animals: Animal[]): Animal[] {
  const remembered = useRef<readonly Animal[]>(animals);
  const next = rememberAnimals(remembered.current, animals);
  remembered.current = next;
  return next as Animal[];
}

export function AnimalSearchField({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View className="mb-2">
      <Text className="text-sm font-medium text-gray-700 mb-1">Search</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search by name or tag"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        placeholderTextColor="#9ca3af"
        style={{
          borderWidth: 1,
          borderColor: '#d1d5db',
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
          fontSize: 16,
          minHeight: 48,
          backgroundColor: '#ffffff',
          color: '#111827',
        }}
      />
    </View>
  );
}
