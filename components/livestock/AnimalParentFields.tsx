import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AnimalSelectField } from '@/components/ui/AnimalSelectField';
import { Input } from '@/components/ui/Input';
import type { Animal } from '@/lib/types/animals';

type SireMode = 'on_farm' | 'external';

type AnimalParentFieldsProps = {
  damAnimals: Animal[];
  sireAnimals: Animal[];
  damId: string | null;
  onDamIdChange: (value: string | null) => void;
  sireId: string | null;
  onSireIdChange: (value: string | null) => void;
  sireExternalName: string;
  onSireExternalNameChange: (value: string) => void;
};

export function AnimalParentFields({
  damAnimals,
  sireAnimals,
  damId,
  onDamIdChange,
  sireId,
  onSireIdChange,
  sireExternalName,
  onSireExternalNameChange,
}: AnimalParentFieldsProps) {
  const [sireMode, setSireMode] = useState<SireMode>(
    sireExternalName.trim() ? 'external' : 'on_farm',
  );

  function selectSireMode(mode: SireMode) {
    setSireMode(mode);
    if (mode === 'on_farm') {
      onSireExternalNameChange('');
    } else {
      onSireIdChange(null);
    }
  }

  return (
    <>
      <Text className="text-base font-semibold text-gray-900 mb-3 mt-2">
        Parents
      </Text>

      <AnimalSelectField
        label="Dam"
        animals={damAnimals}
        value={damId}
        onChange={onDamIdChange}
        allowClear
        emptyMessage="No does on this farm yet."
      />

      <Text className="text-sm font-medium text-gray-700 mb-2">Sire</Text>
      <View className="flex-row gap-2 mb-3">
        {(
          [
            { value: 'on_farm', label: 'On farm' },
            { value: 'external', label: 'External name' },
          ] as const
        ).map((option) => (
          <Pressable
            key={option.value}
            onPress={() => selectSireMode(option.value)}
            className={`flex-1 rounded-xl border px-3 py-3 items-center ${
              sireMode === option.value
                ? 'border-bloodline-600 bg-bloodline-50'
                : 'border-gray-300 bg-white'
            }`}>
            <Text
              className={`font-medium text-sm ${
                sireMode === option.value
                  ? 'text-bloodline-700'
                  : 'text-gray-700'
              }`}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {sireMode === 'on_farm' ? (
        <AnimalSelectField
          label="Sire on farm"
          animals={sireAnimals}
          value={sireId}
          onChange={onSireIdChange}
          allowClear
          emptyMessage="No bucks on this farm yet."
        />
      ) : (
        <Input
          label="External sire name"
          value={sireExternalName}
          onChangeText={onSireExternalNameChange}
          placeholder="Buck from another farm"
        />
      )}
    </>
  );
}
