import { Pressable, Text, View } from 'react-native';

import type { Animal } from '@/lib/types/animals';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';

type AnimalMultiSelectFieldProps = {
  label: string;
  animals: Animal[];
  selectedIds: string[];
  onChange: (animalIds: string[]) => void;
  emptyMessage?: string;
};

export function AnimalMultiSelectField({
  label,
  animals,
  selectedIds,
  onChange,
  emptyMessage = 'No matching animals on this farm.',
}: AnimalMultiSelectFieldProps) {
  function toggle(animalId: string) {
    if (selectedIds.includes(animalId)) {
      onChange(selectedIds.filter((id) => id !== animalId));
      return;
    }
    onChange([...selectedIds, animalId]);
  }

  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-700 mb-2">{label}</Text>
      {animals.length === 0 ? (
        <Text className="text-sm text-gray-500">{emptyMessage}</Text>
      ) : (
        <View className="gap-2">
          {animals.map((animal) => {
            const selected = selectedIds.includes(animal.id);
            return (
              <Pressable
                key={animal.id}
                onPress={() => toggle(animal.id)}
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
