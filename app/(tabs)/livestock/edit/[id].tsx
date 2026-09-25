import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { AnimalBreedFields } from '@/components/livestock/AnimalBreedFields';
import { AnimalIdentityFields } from '@/components/livestock/AnimalIdentityFields';
import { AnimalParentFields } from '@/components/livestock/AnimalParentFields';
import { DeleteRecordButton } from '@/components/DeleteRecordButton';
import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { todayIso } from '@/lib/dates';
import { getActiveMeatWithdrawal } from '@/lib/db/health';
import { meatSaleWarning } from '@/lib/domain/health';
import { confirmAction } from '@/lib/ui/confirm';
import { LoadingState } from '@/components/ui/LoadingState';
import { validateAnimalNameOrTag } from '@/lib/domain/animals';
import {
  createFarmBreed,
  deleteAnimal,
  findAnimalByTagNumber,
  getAnimalById,
  getAnimalDeleteInfo,
  getBreedsForFarm,
  getParentPickerAnimals,
  updateAnimal,
} from '@/lib/db/animals';
import {
  animalDeleteBlockedMessage,
  formatAnimalDeletePreview,
  type AnimalDeleteBlocker,
} from '@/lib/domain/animal-delete';
import type { Animal, Breed } from '@/lib/types/animals';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';
import { useFarm } from '@/providers/FarmProvider';

const SEX_OPTIONS: Animal['sex'][] = ['female', 'male'];

const LIFECYCLE_OPTIONS: Animal['lifecycleStage'][] = [
  'kid',
  'weaned',
  'yearling',
  'breeding',
  'feeder',
  'market_ready',
  'adult',
];

const STATUS_OPTIONS: {
  value: Animal['status'];
  label: string;
}[] = [
  { value: 'active', label: 'Active' },
  { value: 'sold', label: 'Sold' },
  { value: 'died', label: 'Dead' },
  { value: 'slaughtered', label: 'Slaughtered' },
  { value: 'transferred', label: 'Transferred' },
];

export default function EditAnimalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeFarm } = useFarm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [warningMessage, setWarningMessage] = useState('');
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
  const [lifecycleStage, setLifecycleStage] =
    useState<Animal['lifecycleStage']>('kid');
  const [status, setStatus] = useState<Animal['status']>('active');
  const [originalStatus, setOriginalStatus] = useState<Animal['status']>('active');
  const [notes, setNotes] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [outDate, setOutDate] = useState('');
  const [damId, setDamId] = useState<string | null>(null);
  const [sireId, setSireId] = useState<string | null>(null);
  const [sireExternalName, setSireExternalName] = useState('');
  const [damAnimals, setDamAnimals] = useState<Animal[]>([]);
  const [sireAnimals, setSireAnimals] = useState<Animal[]>([]);
  const [deleteBlockers, setDeleteBlockers] = useState<AnimalDeleteBlocker[]>(
    [],
  );
  const [deletePreview, setDeletePreview] = useState('');

  useEffect(() => {
    if (!activeFarm || !id) {
      return;
    }

    let cancelled = false;

    const farm = activeFarm;

    async function load() {
      setLoading(true);
      try {
        const [animal, farmBreeds, does, bucks] = await Promise.all([
          getAnimalById(id),
          getBreedsForFarm(farm.id, farm.segment),
          getParentPickerAnimals(farm.id, 'female', id),
          getParentPickerAnimals(farm.id, 'male', id),
        ]);

        if (cancelled) {
          return;
        }

        if (!animal) {
          setErrorMessage('Animal not found.');
          return;
        }

        setName(animal.name ?? '');
        setTagNumber(animal.tagNumber ?? '');
        setOfficialId(animal.officialId ?? '');
        setRegistrationBody(animal.registrationBody);
        setRegistrationNumber(animal.registrationNumber ?? '');
        setTattoo(animal.tattoo ?? '');
        setSex(animal.sex);
        setBreedId(animal.breedPrimaryId);
        setBreedPercentage(
          animal.breedPercentage != null ? String(animal.breedPercentage) : '',
        );
        setLifecycleStage(animal.lifecycleStage);
        setStatus(animal.status);
        setOriginalStatus(animal.status);
        setNotes(animal.notes ?? '');
        setDateOfBirth(animal.dateOfBirth ?? '');
        setOutDate(animal.outDate ?? todayIso());
        setDamId(animal.damId);
        setSireId(animal.sireId);
        setSireExternalName(animal.sireExternalName ?? '');
        setBreeds(farmBreeds);
        setDamAnimals(does);
        setSireAnimals(bucks);

        const deleteInfo = await getAnimalDeleteInfo(id);
        if (!cancelled) {
          setDeleteBlockers(deleteInfo.blockers);
          setDeletePreview(formatAnimalDeletePreview(deleteInfo));
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Could not load animal.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [activeFarm, id]);

  useEffect(() => {
    if (!activeFarm || !id || !tagNumber.trim()) {
      setWarningMessage('');
      return;
    }

    let cancelled = false;

    findAnimalByTagNumber(activeFarm.id, tagNumber, id).then((existing) => {
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
  }, [activeFarm, id, tagNumber]);

  const breedSegment = useMemo(
    () => activeFarm?.segment ?? 'both',
    [activeFarm?.segment],
  );

  async function handleSave() {
    if (!id || !activeFarm) {
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

    const leavingToSale =
      (status === 'sold' || status === 'slaughtered') && status !== originalStatus;
    if (leavingToSale) {
      const withdrawal = await getActiveMeatWithdrawal(id, todayIso());
      if (withdrawal) {
        const proceed = await confirmAction(
          'Meat withdrawal',
          meatSaleWarning(
            name.trim() || tagNumber.trim() || 'This goat',
            withdrawal.clearDate,
            withdrawal.productName,
          ),
          'Continue',
        );
        if (!proceed) {
          return;
        }
      }
    }

    setSaving(true);

    try {
      const leavingHerd = status !== 'active';

      await updateAnimal(id, {
        name: name.trim() || null,
        tagNumber: tagNumber.trim() || null,
        officialId: officialId.trim() || null,
        sex,
        breedPrimaryId: breedId,
        breedPercentage: parsedBreedPercentage,
        lifecycleStage,
        status,
        notes: notes.trim() || null,
        dateOfBirth: dateOfBirth || null,
        outDate: leavingHerd ? outDate || todayIso() : null,
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
        error instanceof Error ? error.message : 'Could not save changes.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!activeFarm || !id) {
    return null;
  }

  if (loading) {
    return <LoadingState message="Loading animal…" />;
  }

  return (
    <HandWriteBlocked>
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerClassName="p-4">
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

        <Text className="text-sm font-medium text-gray-700 mb-2">
          Lifecycle stage
        </Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {LIFECYCLE_OPTIONS.map((stage) => (
            <Pressable
              key={stage}
              onPress={() => setLifecycleStage(stage)}
              className={`rounded-full border px-3 py-1.5 ${
                lifecycleStage === stage
                  ? 'border-bloodline-600 bg-bloodline-50'
                  : 'border-gray-300 bg-white'
              }`}>
              <Text
                className={`text-sm capitalize ${
                  lifecycleStage === stage
                    ? 'text-bloodline-700 font-medium'
                    : 'text-gray-700'
                }`}>
                {stage.replace(/_/g, ' ')}
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

        <AnimalParentFields
          key={`${id}-${sireExternalName ? 'external' : 'farm'}`}
          damAnimals={damAnimals}
          sireAnimals={sireAnimals}
          damId={damId}
          onDamIdChange={setDamId}
          sireId={sireId}
          onSireIdChange={setSireId}
          sireExternalName={sireExternalName}
          onSireExternalNameChange={setSireExternalName}
        />

        <Text className="text-sm font-medium text-gray-700 mb-2">Status</Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {STATUS_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => {
                setStatus(option.value);
                if (option.value !== 'active' && !outDate) {
                  setOutDate(todayIso());
                }
              }}
              className={`rounded-full border px-3 py-1.5 ${
                status === option.value
                  ? 'border-bloodline-600 bg-bloodline-50'
                  : 'border-gray-300 bg-white'
              }`}>
              <Text
                className={`text-sm ${
                  status === option.value
                    ? 'text-bloodline-700 font-medium'
                    : 'text-gray-700'
                }`}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {status !== 'active' ? (
          <DateField
            label="Out date"
            value={outDate}
            onChange={setOutDate}
            maximumDate={new Date()}
          />
        ) : null}

        <Input
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional notes"
        />

        <Button
          title={saving ? 'Saving…' : 'Save Changes'}
          onPress={handleSave}
          disabled={saving}
          className="mt-2"
        />

        <DeleteRecordButton
          title="Delete goat"
          confirmTitle="Delete this goat?"
          confirmMessage={deletePreview}
          disabled={deleteBlockers.length > 0}
          disabledReason={
            deleteBlockers.length > 0
              ? animalDeleteBlockedMessage(deleteBlockers)
              : undefined
          }
          onDelete={async () => {
            if (!id) {
              return;
            }
            await deleteAnimal(id);
            router.replace('/(tabs)/livestock');
          }}
        />
      </ScrollView>
    </HandWriteBlocked>
  );
}
