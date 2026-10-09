import { useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { animalMatchesSearch, rememberAnimals } from '@/lib/domain/animals';
import type { Animal } from '@/lib/types/animals';
import { Text } from '@/components/ui/Text';
import { TextInput } from '@/components/ui/TextInput';

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
    <View className="mb-3">
      <Text className="text-base font-bold text-ink mb-2">Search</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Name or tag number"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        placeholderTextColor="#8a7b75"
        className="h-14 rounded-[18px] border border-gray-300 bg-white px-4 text-lg text-ink"
      />
    </View>
  );
}
