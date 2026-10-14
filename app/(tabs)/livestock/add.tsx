import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { FormKeyboardScreen } from '@/components/ui/FormKeyboardScreen';

import { AnimalBreedFields } from '@/components/livestock/AnimalBreedFields';
import { AnimalIdentityFields } from '@/components/livestock/AnimalIdentityFields';
import { AnimalParentFields } from '@/components/livestock/AnimalParentFields';
import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { FormMessage } from '@/components/ui/FormMessage';
import { Segmented } from '@/components/ui/Segmented';
import { validateAnimalNameOrTag } from '@/lib/domain/animals';
import {
  addAnimalDraftFromDuplicateSource,
  createEmptyAddAnimalDraft,
  shouldResetAddAnimalDraftOnFocus,
  type AddAnimalDraft,
} from '@/lib/domain/add-animal-form';
import {
  createAnimal,
  createFarmBreed,
  findAnimalByTagNumber,
  getAnimalById,
  getBreedsForFarm,
  getParentPickerAnimals,
} from '@/lib/db/animals';
import type { Animal, Breed } from '@/lib/types/animals';
import { animalDisplayLabel, formatSex } from '@/lib/ui/animal-labels';
import { confirmAction } from '@/lib/ui/confirm';
import { useFarm } from '@/providers/FarmProvider';
import { Text } from '@/components/ui/Text';

const SEX_OPTIONS: Animal['sex'][] = ['female', 'male'];

export default function AddAnimalScreen() {
  const params = useLocalSearchParams<{
    duplicateFrom?: string;
    prefill?: string;
  }>();
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
  const [damExternalName, setDamExternalName] = useState('');
  const [sireId, setSireId] = useState<string | null>(null);
  const [sireExternalName, setSireExternalName] = useState('');
  const [damAnimals, setDamAnimals] = useState<Animal[]>([]);
  const [sireAnimals, setSireAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [warningMessage, setWarningMessage] = useState('');
  const focusVisitRef = useRef(0);
  const appliedDuplicatePrefillRef = useRef<string | null>(null);

  const applyDraft = useCallback((draft: AddAnimalDraft) => {
    setName(draft.name);
    setTagNumber(draft.tagNumber);
    setOfficialId(draft.officialId);
    setRegistrationBody(draft.registrationBody);
    setRegistrationNumber(draft.registrationNumber);
    setTattoo(draft.tattoo);
    setSex(draft.sex);
    setBreedId(draft.breedId);
    setBreedPercentage(draft.breedPercentage);
    setDateOfBirth(draft.dateOfBirth);
    setDamId(draft.damId);
    setDamExternalName(draft.damExternalName);
    setSireId(draft.sireId);
    setSireExternalName(draft.sireExternalName);
  }, []);

  const resetToEmptyDraft = useCallback(() => {
    applyDraft(createEmptyAddAnimalDraft());
    setErrorMessage('');
    setWarningMessage('');
  }, [applyDraft]);

  useFocusEffect(
    useCallback(() => {
      const visitIndex = focusVisitRef.current;
      focusVisitRef.current += 1;

      if (
        shouldResetAddAnimalDraftOnFocus(
          visitIndex,
          {
            duplicateFrom: params.duplicateFrom,
            prefill: params.prefill,
          },
          appliedDuplicatePrefillRef.current,
        )
      ) {
        resetToEmptyDraft();
      }

      return () => {};
    }, [
      params.duplicateFrom,
      params.prefill,
      resetToEmptyDraft,
    ]),
  );

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
    const duplicateFrom = params.duplicateFrom;
    const prefill = params.prefill;
    if (!duplicateFrom || !prefill) {
      return;
    }
    if (appliedDuplicatePrefillRef.current === prefill) {
      return;
    }

    let cancelled = false;

    getAnimalById(duplicateFrom).then((animal) => {
      if (cancelled) {
        return;
      }
      appliedDuplicatePrefillRef.current = prefill;
      if (animal) {
        applyDraft(addAnimalDraftFromDuplicateSource(animal));
        setErrorMessage('');
        setWarningMessage('');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [params.duplicateFrom, params.prefill, applyDraft]);

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

    if (warningMessage) {
      const confirmed = await confirmAction(
        'Duplicate tag?',
        warningMessage,
        'Save anyway',
      );
      if (!confirmed) {
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
        damId: damExternalName.trim() ? null : damId,
        damExternalName: damExternalName.trim() || null,
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
      <FormKeyboardScreen
        contentContainerClassName="px-5 pt-3 pb-8"
        footer={
          <Button
            title={loading ? 'Saving…' : 'Save goat'}
            onPress={handleSave}
            disabled={loading}
            className="min-h-[60px] rounded-[18px]"
          />
        }>
        <FormMessage message={errorMessage} tone="error" />
        <FormMessage message={warningMessage} tone="warning" />

        <AnimalIdentityFields
          section="basic"
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

        <FieldLabel>Sex</FieldLabel>
        <View className="mb-4">
          <Segmented
            options={SEX_OPTIONS.map((option) => ({
              value: option,
              label: formatSex(option),
            }))}
            value={sex}
            onChange={setSex}
          />
        </View>

        <DateField
          label="Date of birth"
          value={dateOfBirth}
          onChange={setDateOfBirth}
          optional
          maximumDate={new Date()}
        />

        <AnimalBreedFields
          section="breed"
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
          section="dam"
          damAnimals={damAnimals}
          sireAnimals={sireAnimals}
          damId={damId}
          onDamIdChange={setDamId}
          damExternalName={damExternalName}
          onDamExternalNameChange={setDamExternalName}
          sireId={sireId}
          onSireIdChange={setSireId}
          sireExternalName={sireExternalName}
          onSireExternalNameChange={setSireExternalName}
        />

        <Text className="text-xl font-extrabold text-ink mt-4 mb-1">More details</Text>
        <Text className="text-[15px] text-gray-500 mb-4">
          Registry, tattoo, breed percentage and sire. You can skip these.
        </Text>

        <AnimalIdentityFields
          section="more"
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

        <AnimalBreedFields
          section="percentage"
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
          section="sire"
          damAnimals={damAnimals}
          sireAnimals={sireAnimals}
          damId={damId}
          onDamIdChange={setDamId}
          damExternalName={damExternalName}
          onDamExternalNameChange={setDamExternalName}
          sireId={sireId}
          onSireIdChange={setSireId}
          sireExternalName={sireExternalName}
          onSireExternalNameChange={setSireExternalName}
        />
      </FormKeyboardScreen>
    </HandWriteBlocked>
  );
}
