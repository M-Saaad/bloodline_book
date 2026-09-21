import { Pressable, Text, View } from 'react-native';

import type { Animal } from '@/lib/types/animals';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';

type AnimalSelectFieldProps = {
  label: string;
  animals: Animal[];
  value: string | null;
  onChange: (animalId: string) => void;
  emptyMessage?: string;
};

export function AnimalSelectField({
  label,
  animals,
  value,
  onChange,
  emptyMessage = 'No matching animals on this farm.',
}: AnimalSelectFieldProps) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-700 mb-2">{label}</Text>
      {animals.length === 0 ? (
        <Text className="text-sm text-gray-500">{emptyMessage}</Text>
      ) : (
        <View className="gap-2">
          {animals.map((animal) => {
            const selected = value === animal.id;
            return (
              <Pressable
                key={animal.id}
                onPress={() => onChange(animal.id)}
                className={`rounded-xl border px-3 py-3 ${
                  selected
                    ? 'border-bloodline-600 bg-bloodline-50'
                    : 'border-gray-300 bg-white'
                }`}>
                <Text
                  className={`font-medium ${
                    selected ? 'text-bloodline-700' : 'text-gray-900'
                  }`}>
                  {animalDisplayLabel(animal)}
                </Text>
                <Text className="text-xs text-gray-500 capitalize mt-0.5">
                  {animal.sex} · {animal.lifecycleStage.replace(/_/g, ' ')}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
