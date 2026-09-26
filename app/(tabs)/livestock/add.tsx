import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { AnimalBreedFields } from '@/components/livestock/AnimalBreedFields';
import { AnimalIdentityFields } from '@/components/livestock/AnimalIdentityFields';
import { AnimalParentFields } from '@/components/livestock/AnimalParentFields';
import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { FormMessage } from '@/components/ui/FormMessage';
import { validateAnimalNameOrTag } from '@/lib/domain/animals';
import {
  createAnimal,
  createFarmBreed,
  findAnimalByTagNumber,
  getBreedsForFarm,
  getParentPickerAnimals,
} from '@/lib/db/animals';
import type { Animal, Breed } from '@/lib/types/animals';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';
import { useFarm } from '@/providers/FarmProvider';

const SEX_OPTIONS: Animal['sex'][] = ['female', 'male'];

export default function AddAnimalScreen() {
  const { activeFarm } = useFarm();
  const [name, setName] = useState('');
  const [tagNumber, setTagNumber] = useState('');
  const [officialId, setOfficialId] = useState('');
  const [registrationBody, setRegistrationBody] =
    useState<Animal['registrationBody']>(null);
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [tattoo, setTattoo] = useState('');
  const [sex, setSex] = useState<Animal['sex']>('female');
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [breedId, setBreedId] = useState<string | null>(null);
  const [breedPercentage, setBreedPercentage] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [damId, setDamId] = useState<string | null>(null);
  const [sireId, setSireId] = useState<string | null>(null);
  const [sireExternalName, setSireExternalName] = useState('');
  const [damAnimals, setDamAnimals] = useState<Animal[]>([]);
  const [sireAnimals, setSireAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [warningMessage, setWarningMessage] = useState('');

  useEffect(() => {
    if (!activeFarm) {
      return;
    }

    Promise.all([
      getBreedsForFarm(activeFarm.id, activeFarm.segment),
      getParentPickerAnimals(activeFarm.id, 'female'),
      getParentPickerAnimals(activeFarm.id, 'male'),
    ]).then(([farmBreeds, does, bucks]) => {
      setBreeds(farmBreeds);
      setDamAnimals(does);
      setSireAnimals(bucks);
    });
  }, [activeFarm]);

  useEffect(() => {
    if (!activeFarm || !tagNumber.trim()) {
      setWarningMessage('');
      return;
    }

    let cancelled = false;

    findAnimalByTagNumber(activeFarm.id, tagNumber).then((existing) => {
      if (cancelled) {
        return;
      }
      if (existing) {
        setWarningMessage(
          `Tag ${tagNumber.trim()} is already used by ${animalDisplayLabel(existing)}.`,
        );
      } else {
        setWarningMessage('');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeFarm, tagNumber]);

  const breedSegment = useMemo(
    () => activeFarm?.segment ?? 'both',
    [activeFarm?.segment],
  );

  async function handleSave() {
    if (!activeFarm) {
      return;
    }

    setErrorMessage('');
    const validationError = validateAnimalNameOrTag(name, tagNumber);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    let parsedBreedPercentage: number | null = null;
    if (breedPercentage.trim()) {
      parsedBreedPercentage = Number.parseFloat(breedPercentage);
      if (
        Number.isNaN(parsedBreedPercentage) ||
        parsedBreedPercentage < 0 ||
        parsedBreedPercentage > 100
      ) {
        setErrorMessage('Enter a breed percentage between 0 and 100.');
        return;
      }
    }

    setLoading(true);
    try {
      await createAnimal(activeFarm.id, {
        name: name.trim() || null,
        tagNumber: tagNumber.trim() || null,
        officialId: officialId.trim() || null,
        sex,
        breedPrimaryId: breedId,
        breedPercentage: parsedBreedPercentage,
        dateOfBirth: dateOfBirth || null,
        damId,
        sireId: sireExternalName.trim() ? null : sireId,
        sireExternalName: sireExternalName.trim() || null,
        registrationBody,
        registrationNumber: registrationNumber.trim() || null,
        tattoo: tattoo.trim() || null,
      });
      router.back();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not save animal.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (!activeFarm) {
    return null;
  }

  return (
    <HandWriteBlocked>
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerClassName="p-4"
        keyboardShouldPersistTaps="handled">
        <FormMessage message={errorMessage} tone="error" />
        <FormMessage message={warningMessage} tone="warning" />

        <AnimalIdentityFields
          name={name}
          onNameChange={setName}
          tagNumber={tagNumber}
          onTagNumberChange={setTagNumber}
          officialId={officialId}
          onOfficialIdChange={setOfficialId}
          registrationBody={registrationBody}
          onRegistrationBodyChange={setRegistrationBody}
          registrationNumber={registrationNumber}
          onRegistrationNumberChange={setRegistrationNumber}
          tattoo={tattoo}
          onTattooChange={setTattoo}
        />

        <Text className="text-sm font-medium text-gray-700 mb-2">Sex</Text>
        <View className="flex-row gap-2 mb-4">
          {SEX_OPTIONS.map((option) => (
            <Pressable
              key={option}
              onPress={() => setSex(option)}
              className={`flex-1 rounded-xl border px-3 py-3 items-center capitalize ${
                sex === option
                  ? 'border-bloodline-600 bg-bloodline-50'
                  : 'border-gray-300 bg-white'
              }`}>
              <Text
                className={`font-medium ${
                  sex === option ? 'text-bloodline-700' : 'text-gray-700'
                }`}>
                {option}
              </Text>
            </Pressable>
          ))}
        </View>

        <DateField
          label="Date of birth"
          value={dateOfBirth}
          onChange={setDateOfBirth}
          optional
          maximumDate={new Date()}
        />

        <AnimalBreedFields
          breeds={breeds}
          breedId={breedId}
          onBreedIdChange={setBreedId}
          breedPercentage={breedPercentage}
          onBreedPercentageChange={setBreedPercentage}
          onCreateCustomBreed={(breedName) =>
            createFarmBreed(activeFarm.id, breedName, breedSegment)
          }
        />

        <AnimalParentFields
          damAnimals={damAnimals}
          sireAnimals={sireAnimals}
          damId={damId}
          onDamIdChange={setDamId}
          sireId={sireId}
          onSireIdChange={setSireId}
          sireExternalName={sireExternalName}
          onSireExternalNameChange={setSireExternalName}
        />

        <Button
          title={loading ? 'Saving…' : 'Save Animal'}
          onPress={handleSave}
          disabled={loading}
        />
      </ScrollView>
    </HandWriteBlocked>
  );
}
