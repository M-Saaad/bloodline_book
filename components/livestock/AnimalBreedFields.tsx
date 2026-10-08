import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { FormMessage } from '@/components/ui/FormMessage';
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
  /** breed = breed chips, percentage = breed percentage only. */
  section?: 'breed' | 'percentage' | 'all';
};

export function AnimalBreedFields({
  breeds,
  breedId,
  onBreedIdChange,
  breedPercentage,
  onBreedPercentageChange,
  onCreateCustomBreed,
  section = 'all',
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
      {section !== 'percentage' ? (
        <>
          <FieldLabel>Breed</FieldLabel>
          <View className="mb-4">
            <ChipRow>
              {breeds.map((breed) => (
                <Chip
                  key={breed.id}
                  label={breed.name}
                  selected={breedId === breed.id}
                  onPress={() =>
                    onBreedIdChange(breedId === breed.id ? null : breed.id)
                  }
                />
              ))}
              {!showCustomBreed ? (
                <Chip
                  label="Other breed…"
                  onPress={() => setShowCustomBreed(true)}
                />
              ) : null}
            </ChipRow>
          </View>

          {showCustomBreed ? (
            <View className="mb-2">
              <Input
                label="Custom breed name"
                value={customBreedName}
                onChangeText={setCustomBreedName}
                placeholder="My cross"
              />
              <FormMessage message={breedError} />
              <View className="flex-row gap-3 mb-4">
                <Button
                  title="Cancel"
                  variant="outline"
                  className="flex-1"
                  onPress={() => {
                    setShowCustomBreed(false);
                    setCustomBreedName('');
                    setBreedError('');
                  }}
                />
                <Button
                  title={creatingBreed ? 'Adding…' : 'Add breed'}
                  className="flex-1"
                  disabled={creatingBreed}
                  onPress={handleAddCustomBreed}
                />
              </View>
            </View>
          ) : null}
        </>
      ) : null}
      {section !== 'breed' ? (
        <>
          <FieldLabel optional>Breed percentage</FieldLabel>
          <View className="mb-4">
            <ChipRow>
              {BREED_PERCENTAGE_QUICK_PICKS.map((value) => (
                <Chip
                  key={value}
                  label={`${value}%`}
                  selected={breedPercentage === String(value)}
                  onPress={() => onBreedPercentageChange(String(value))}
                />
              ))}
            </ChipRow>
          </View>
          <Input
            label="Exact percentage"
            value={breedPercentage}
            onChangeText={onBreedPercentageChange}
            placeholder="Optional"
            keyboardType="decimal-pad"
          />
        </>
      ) : null}
    </>
  );
}
