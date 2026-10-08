import { View } from 'react-native';

import { Chip, ChipRow } from '@/components/ui/Chip';
import { FieldLabel } from '@/components/ui/FieldLabel';
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
  /** basic = name and tag, more = registry, official ID and tattoo. */
  section?: 'basic' | 'more' | 'all';
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
  section = 'all',
}: AnimalIdentityFieldsProps) {
  const showBasic = section !== 'more';
  const showMore = section !== 'basic';
  return (
    <>
      {showBasic ? (
        <>
          <Input
            label="Name"
            value={name}
            onChangeText={onNameChange}
            placeholder="Daisy"
          />
          <Input
            label="Tag number"
            value={tagNumber}
            onChangeText={onTagNumberChange}
            placeholder="A-101"
          />
        </>
      ) : null}
      {showMore ? (
        <>
          <Input
            label="Official ID"
            value={officialId}
            onChangeText={onOfficialIdChange}
            placeholder="Scrapie tag or USDA ID"
            optional
          />

          <FieldLabel optional>Registry</FieldLabel>
          <View className="mb-4">
            <ChipRow>
              {REGISTRATION_BODY_OPTIONS.map((option) => {
                const selected = registrationBody === option.value;
                return (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={selected}
                    onPress={() =>
                      onRegistrationBodyChange(selected ? null : option.value)
                    }
                  />
                );
              })}
            </ChipRow>
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
            optional
          />
        </>
      ) : null}
    </>
  );
}
