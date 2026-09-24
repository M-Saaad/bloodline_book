import { Pressable, Text, View } from 'react-native';

import { Input } from '@/components/ui/Input';
import { REGISTRATION_BODY_OPTIONS } from '@/lib/domain/animals';
import type { Animal } from '@/lib/types/animals';

type AnimalIdentityFieldsProps = {
  name: string;
  onNameChange: (value: string) => void;
  tagNumber: string;
  onTagNumberChange: (value: string) => void;
  officialId: string;
  onOfficialIdChange: (value: string) => void;
  registrationBody: Animal['registrationBody'];
  onRegistrationBodyChange: (value: Animal['registrationBody']) => void;
  registrationNumber: string;
  onRegistrationNumberChange: (value: string) => void;
  tattoo: string;
  onTattooChange: (value: string) => void;
};

export function AnimalIdentityFields({
  name,
  onNameChange,
  tagNumber,
  onTagNumberChange,
  officialId,
  onOfficialIdChange,
  registrationBody,
  onRegistrationBodyChange,
  registrationNumber,
  onRegistrationNumberChange,
  tattoo,
  onTattooChange,
}: AnimalIdentityFieldsProps) {
  return (
    <>
      <Text className="text-base font-semibold text-gray-900 mb-3">Identity</Text>
      <Input label="Name" value={name} onChangeText={onNameChange} placeholder="Daisy" />
      <Input
        label="Tag number"
        value={tagNumber}
        onChangeText={onTagNumberChange}
        placeholder="A-101"
      />
      <Input
        label="Official ID"
        value={officialId}
        onChangeText={onOfficialIdChange}
        placeholder="Scrapie tag or USDA official ID"
      />

      <Text className="text-sm font-medium text-gray-700 mb-2">Registry</Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {REGISTRATION_BODY_OPTIONS.map((option) => {
          const selected = registrationBody === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() =>
                onRegistrationBodyChange(
                  selected ? null : option.value,
                )
              }
              className={`rounded-full border px-3 py-1.5 ${
                selected
                  ? 'border-bloodline-600 bg-bloodline-50'
                  : 'border-gray-300 bg-white'
              }`}>
              <Text
                className={`text-sm ${
                  selected ? 'text-bloodline-700 font-medium' : 'text-gray-700'
                }`}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Input
        label="Registration number"
        value={registrationNumber}
        onChangeText={onRegistrationNumberChange}
        placeholder="Optional"
      />
      <Input
        label="Tattoo"
        value={tattoo}
        onChangeText={onTattooChange}
        placeholder="Right ear / Left ear"
        hint="Right ear / Left ear"
      />
    </>
  );
}
