import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { AnimalBreedFields } from '@/components/livestock/AnimalBreedFields';
import { AnimalIdentityFields } from '@/components/livestock/AnimalIdentityFields';
import { AnimalParentFields } from '@/components/livestock/AnimalParentFields';
import { DeleteRecordButton } from '@/components/DeleteRecordButton';
import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { FormKeyboardScreen } from '@/components/ui/FormKeyboardScreen';
import { Segmented } from '@/components/ui/Segmented';
import { DateField } from '@/components/ui/DateField';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { formatMonthDay, todayIso } from '@/lib/dates';
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
  getAnimalsByFarm,
  getBreedsForFarm,
  updateAnimal,
} from '@/lib/db/animals';
import { pedigreeBlockers, type PickerBlock } from '@/lib/ui/animal-picker';
import {
  animalDeleteBlockedMessage,
  formatAnimalDeletePreview,
  type AnimalDeleteBlocker,
} from '@/lib/domain/animal-delete';
import type { Animal, Breed } from '@/lib/types/animals';
import { animalDisplayLabel, formatLifecycleStage } from '@/lib/ui/animal-labels';
import { useFarm } from '@/providers/FarmProvider';
import { Text } from '@/components/ui/Text';

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

function capitalizeFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

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
  const [damExternalName, setDamExternalName] = useState('');
  const [sireId, setSireId] = useState<string | null>(null);
  const [sireExternalName, setSireExternalName] = useState('');
  const [damAnimals, setDamAnimals] = useState<Animal[]>([]);
  const [sireAnimals, setSireAnimals] = useState<Animal[]>([]);
  const [parentBlocks, setParentBlocks] = useState<PickerBlock[]>([]);
  const [deleteBlockers, setDeleteBlockers] = useState<AnimalDeleteBlocker[]>(
    [],
  );
  const [deletePreview, setDeletePreview] = useState('');
  const [withdrawalClearDate, setWithdrawalClearDate] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;
    getActiveMeatWithdrawal(id, todayIso())
      .then((withdrawal) => {
        if (!cancelled) {
          setWithdrawalClearDate(withdrawal?.clearDate ?? null);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!activeFarm || !id) {
      return;
    }

    let cancelled = false;

    const farm = activeFarm;

    async function load() {
      setLoading(true);
      try {
        const [animal, farmBreeds, herd] = await Promise.all([
          getAnimalById(id),
          getBreedsForFarm(farm.id, farm.segment),
          getAnimalsByFarm(farm.id, 'all'),
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
        setDamExternalName(animal.damExternalName ?? '');
        setSireId(animal.sireId);
        setSireExternalName(animal.sireExternalName ?? '');
        setBreeds(farmBreeds);
        setDamAnimals(herd.filter((item) => item.sex === 'female'));
        setSireAnimals(herd.filter((item) => item.sex === 'male'));
        setParentBlocks(pedigreeBlockers(id, herd));

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

  const identityProps = {
    name,
    onNameChange: setName,
    tagNumber,
    onTagNumberChange: setTagNumber,
    officialId,
    onOfficialIdChange: setOfficialId,
    registrationBody,
    onRegistrationBodyChange: setRegistrationBody,
    registrationNumber,
    onRegistrationNumberChange: setRegistrationNumber,
    tattoo,
    onTattooChange: setTattoo,
  };
  const breedProps = {
    breeds,
    breedId,
    onBreedIdChange: setBreedId,
    breedPercentage,
    onBreedPercentageChange: setBreedPercentage,
    onCreateCustomBreed: (breedName: string) =>
      createFarmBreed(activeFarm.id, breedName, breedSegment),
  };
  const parentProps = {
    damAnimals,
    sireAnimals,
    damId,
    onDamIdChange: setDamId,
    damExternalName,
    onDamExternalNameChange: setDamExternalName,
    sireId,
    onSireIdChange: setSireId,
    sireExternalName,
    onSireExternalNameChange: setSireExternalName,
    exclude: parentBlocks,
  };

  return (
    <HandWriteBlocked>
      <FormKeyboardScreen
        contentContainerClassName="px-5 pt-3 pb-8"
        footer={
          <Button
            title={saving ? 'Saving…' : 'Save Changes'}
            onPress={handleSave}
            disabled={saving}
            className="min-h-[60px] rounded-[18px]"
          />
        }>
        <FormMessage message={errorMessage} tone="error" />
        <FormMessage message={warningMessage} tone="warning" />

        <FieldLabel>Status</FieldLabel>
        <View className="mb-4">
          <ChipRow>
            {STATUS_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={status === option.value}
                onPress={() => {
                  setStatus(option.value);
                  if (option.value !== 'active' && !outDate) {
                    setOutDate(todayIso());
                  }
                }}
              />
            ))}
          </ChipRow>
        </View>

        {withdrawalClearDate ? (
          <View className="mb-4">
            <Banner
              tone="stop"
              title="Meat withdrawal is active"
              message={`Do not sell until ${formatMonthDay(withdrawalClearDate)}. Saving as Sold will ask you to confirm.`}
            />
          </View>
        ) : null}

        {status !== 'active' ? (
          <DateField
            label="Out date"
            value={outDate}
            onChange={setOutDate}
            maximumDate={new Date()}
          />
        ) : null}

        <FieldLabel>Life stage</FieldLabel>
        <View className="mb-4">
          <ChipRow>
            {LIFECYCLE_OPTIONS.map((stage) => (
              <Chip
                key={stage}
                label={capitalizeFirst(formatLifecycleStage(stage))}
                selected={lifecycleStage === stage}
                onPress={() => setLifecycleStage(stage)}
              />
            ))}
          </ChipRow>
        </View>

        <Input
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional notes"
          optional
          multiline
        />

        <Text className="text-xl font-extrabold text-ink mt-2 mb-3">Details</Text>
        <AnimalIdentityFields section="basic" {...identityProps} />

        <FieldLabel>Sex</FieldLabel>
        <View className="mb-4">
          <Segmented
            options={SEX_OPTIONS.map((option) => ({
              value: option,
              label: option === 'female' ? 'Doe' : 'Buck',
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

        <AnimalBreedFields section="breed" {...breedProps} />
        <AnimalParentFields section="dam" {...parentProps} />

        <Text className="text-xl font-extrabold text-ink mt-4 mb-3">More details</Text>
        <AnimalIdentityFields section="more" {...identityProps} />
        <AnimalBreedFields section="percentage" {...breedProps} />
        <AnimalParentFields section="sire" {...parentProps} />

        <DeleteRecordButton
          title="Delete goat"
          confirmTitle="Delete this goat?"
          confirmMessage={deletePreview}
          note={deletePreview || undefined}
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
      </FormKeyboardScreen>
    </HandWriteBlocked>
  );
}
