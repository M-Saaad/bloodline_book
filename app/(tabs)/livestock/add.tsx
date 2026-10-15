import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from '@/lib/navigation/use-prevent-remove';
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
  isAddAnimalDraftDirty,
  shouldApplyDuplicatePrefillLoad,
  shouldResetAddAnimalDraftForSession,
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
import { registerAddAnimalUnsavedHandlers } from '@/lib/navigation/add-animal-unsaved-guard';
import { confirmAction } from '@/lib/ui/confirm';
import { useFarm } from '@/providers/FarmProvider';
import { Text } from '@/components/ui/Text';

const SEX_OPTIONS: Animal['sex'][] = ['female', 'male'];

function routeParamFirst(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

export default function AddAnimalScreen() {
  const params = useLocalSearchParams<{
    session?: string;
    duplicateFrom?: string;
    prefill?: string;
  }>();
  const sessionId = routeParamFirst(params.session);
  const duplicateFromParam = routeParamFirst(params.duplicateFrom);
  const prefillParam = routeParamFirst(params.prefill);
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
  const navigation = useNavigation();
  const committedSessionRef = useRef<string | null>(null);
  const appliedDuplicatePrefillRef = useRef<string | null>(null);
  const duplicateLoadGenerationRef = useRef(0);
  const baselineDraftRef = useRef<AddAnimalDraft>(createEmptyAddAnimalDraft());
  const allowLeaveRef = useRef(false);

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
    duplicateLoadGenerationRef.current += 1;
    appliedDuplicatePrefillRef.current = null;
    const empty = createEmptyAddAnimalDraft();
    applyDraft(empty);
    baselineDraftRef.current = empty;
    setErrorMessage('');
    setWarningMessage('');
  }, [applyDraft]);

  useEffect(() => {
    if (
      shouldResetAddAnimalDraftForSession(
        sessionId,
        committedSessionRef.current,
        {
          duplicateFrom: duplicateFromParam || undefined,
          prefill: prefillParam || undefined,
        },
        appliedDuplicatePrefillRef.current,
      )
    ) {
      resetToEmptyDraft();
    }
    committedSessionRef.current = sessionId;
  }, [sessionId, duplicateFromParam, prefillParam, resetToEmptyDraft]);

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
    if (!duplicateFromParam || !prefillParam) {
      return;
    }
    if (appliedDuplicatePrefillRef.current === prefillParam) {
      return;
    }

    let cancelled = false;
    const loadGeneration = duplicateLoadGenerationRef.current;

    getAnimalById(duplicateFromParam).then((animal) => {
      if (cancelled) {
        return;
      }
      if (
        !shouldApplyDuplicatePrefillLoad(
          loadGeneration,
          duplicateLoadGenerationRef.current,
        )
      ) {
        return;
      }
      appliedDuplicatePrefillRef.current = prefillParam;
      if (animal) {
        const draft = addAnimalDraftFromDuplicateSource(animal);
        applyDraft(draft);
        baselineDraftRef.current = draft;
        setErrorMessage('');
        setWarningMessage('');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [duplicateFromParam, prefillParam, applyDraft]);

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

  const currentDraft = useMemo(
    (): AddAnimalDraft => ({
      name,
      tagNumber,
      officialId,
      registrationBody,
      registrationNumber,
      tattoo,
      sex,
      breedId,
      breedPercentage,
      dateOfBirth,
      damId,
      damExternalName,
      sireId,
      sireExternalName,
    }),
    [
      name,
      tagNumber,
      officialId,
      registrationBody,
      registrationNumber,
      tattoo,
      sex,
      breedId,
      breedPercentage,
      dateOfBirth,
      damId,
      damExternalName,
      sireId,
      sireExternalName,
    ],
  );

  const hasUnsavedChanges = useMemo(
    () => isAddAnimalDraftDirty(currentDraft, baselineDraftRef.current),
    [currentDraft],
  );

  const confirmDiscardIfNeeded = useCallback(async (): Promise<boolean> => {
    if (!hasUnsavedChanges || allowLeaveRef.current) {
      return true;
    }
    const discard = await confirmAction(
      'Discard this goat?',
      'You have unsaved changes on this form.',
      'Discard',
      'Keep editing',
    );
    if (discard) {
      allowLeaveRef.current = true;
    }
    return discard;
  }, [hasUnsavedChanges]);

  useFocusEffect(
    useCallback(() => {
      allowLeaveRef.current = false;
      return registerAddAnimalUnsavedHandlers({
        isDirty: () => hasUnsavedChanges && !allowLeaveRef.current,
        confirmDiscard: confirmDiscardIfNeeded,
      });
    }, [confirmDiscardIfNeeded, hasUnsavedChanges]),
  );

  usePreventRemove(hasUnsavedChanges && !allowLeaveRef.current, ({ data }) => {
    void (async () => {
      const discard = await confirmDiscardIfNeeded();
      if (!discard) {
        return;
      }
      navigation.dispatch(data.action);
    })();
  });

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
      allowLeaveRef.current = true;
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
