import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  AnimalPickerModal,
  type PickerQuickChip,
} from '@/components/ui/AnimalPickerModal';
import { formatLivestockRowTitle } from '@/lib/domain/animals';
import {
  loadOutsideAnimals,
  loadRecentAnimalIds,
  outsideRecentId,
  rememberAnimalId,
} from '@/lib/storage/barn-memory';
import type { Animal } from '@/lib/types/animals';
import {
  formatOutsideAnimalLabel,
  UNKNOWN_PARENT_LABEL,
  type OutsideAnimal,
  type PickerBlock,
} from '@/lib/ui/animal-picker';
import { useFarm } from '@/providers/FarmProvider';

type SharedPickerProps = {
  label: string;
  animals: Animal[];
  emptyMessage?: string;
  quickChips?: PickerQuickChip[];
  exclude?: PickerBlock[];
  disabled?: PickerBlock[];
  pastureByAnimalId?: Record<string, string | undefined>;
  breedById?: Record<string, string | undefined>;
  suggestedIds?: string[];
};

export type AnimalPickerSingleProps = SharedPickerProps & {
  mode: 'single';
  value: string | null;
  onChange: (animalId: string | null) => void;
  externalLabel?: string | null;
  onExternalLabelChange?: (label: string | null) => void;
  allowClear?: boolean;
  allowUnknown?: boolean;
  allowOutside?: boolean;
  outsideSex?: Animal['sex'];
};

export type AnimalPickerMultiProps = SharedPickerProps & {
  mode: 'multi';
  selectedIds: string[];
  onChange: (animalIds: string[]) => void;
};

export type AnimalPickerFieldProps = AnimalPickerSingleProps | AnimalPickerMultiProps;

export function AnimalPickerField(props: AnimalPickerFieldProps) {
  const { activeFarm } = useFarm();
  const [open, setOpen] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [outsideAnimals, setOutsideAnimals] = useState<OutsideAnimal[]>([]);
  const mode = props.mode;
  const farmId = activeFarm?.id ?? null;

  useEffect(() => {
    if (!farmId) {
      return;
    }
    let cancelled = false;
    Promise.all([loadRecentAnimalIds(farmId), loadOutsideAnimals(farmId)]).then(
      ([recent, outside]) => {
        if (cancelled) {
          return;
        }
        setRecentIds(recent);
        setOutsideAnimals(outside);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [farmId, open]);

  async function remember(id: string) {
    if (!farmId) {
      return;
    }
    await rememberAnimalId(farmId, id);
    setRecentIds(await loadRecentAnimalIds(farmId));
  }

  const selectedIds = mode === 'multi' ? props.selectedIds : props.value ? [props.value] : [];
  const summary = summaryLabel(props);

  return (
    <View className="mb-4">
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${props.label}. ${summary}. Change`}
        className="min-h-[56px] flex-row items-center rounded-xl border border-gray-300 bg-white px-3 py-3">
        <View className="flex-1 pr-3">
          <Text className="text-sm font-medium text-gray-700">{props.label}</Text>
          <Text numberOfLines={1} className="text-base font-semibold text-gray-900 mt-0.5">
            {summary}
          </Text>
        </View>
        <Text className="text-bloodline-700 font-semibold">Change</Text>
      </Pressable>

      <AnimalPickerModal
        visible={open}
        title={props.label}
        animals={props.animals}
        mode={mode}
        selectedIds={selectedIds}
        onClose={() => setOpen(false)}
        onSelectAnimal={(animalId) => {
          if (props.mode === 'multi') {
            return;
          }
          props.onChange(animalId);
          props.onExternalLabelChange?.(null);
          void remember(animalId);
        }}
        onChangeSelected={(ids) => {
          if (props.mode === 'multi') {
            props.onChange(ids);
            const added = ids.find((id) => !props.selectedIds.includes(id));
            if (added) {
              void remember(added);
            }
          }
        }}
        onClear={
          props.mode === 'multi' || !props.allowClear
            ? undefined
            : () => {
                props.onChange(null);
                props.onExternalLabelChange?.(null);
              }
        }
        onUnknown={
          props.mode === 'multi' || !props.allowUnknown
            ? undefined
            : () => {
                props.onChange(null);
                props.onExternalLabelChange?.(UNKNOWN_PARENT_LABEL);
              }
        }
        onOutside={(animal) => {
          if (props.mode === 'multi') {
            return;
          }
          props.onChange(null);
          props.onExternalLabelChange?.(formatOutsideAnimalLabel(animal));
          void remember(outsideRecentId(animal.id));
        }}
        allowClear={props.mode !== 'multi' && Boolean(props.allowClear)}
        allowUnknown={props.mode !== 'multi' && Boolean(props.allowUnknown)}
        allowOutside={props.mode !== 'multi' && Boolean(props.allowOutside)}
        outsideSex={
          props.mode === 'multi' ? 'male' : (props.outsideSex ?? 'male')
        }
        outsideAnimals={outsideAnimals}
        recentIds={recentIds}
        exclude={props.exclude ?? []}
        disabled={props.disabled ?? []}
        quickChips={props.quickChips ?? []}
        pastureByAnimalId={props.pastureByAnimalId ?? {}}
        breedById={props.breedById ?? {}}
        suggestedIds={props.suggestedIds ?? []}
        emptyMessage={props.emptyMessage ?? 'No matching animals on this farm.'}
        farmId={farmId}
        onOutsideListChange={setOutsideAnimals}
      />
    </View>
  );
}

function summaryLabel(props: AnimalPickerFieldProps): string {
  if (props.mode === 'multi') {
    if (props.selectedIds.length === 0) {
      return 'None selected';
    }
    if (props.selectedIds.length === 1) {
      const animal = props.animals.find((item) => item.id === props.selectedIds[0]);
      return animal ? formatLivestockRowTitle(animal) : '1 goat';
    }
    return `${props.selectedIds.length} goats`;
  }

  if (props.value) {
    const animal = props.animals.find((item) => item.id === props.value);
    return animal ? formatLivestockRowTitle(animal) : 'Selected goat';
  }
  const external = props.externalLabel?.trim();
  if (external) {
    return external;
  }
  return 'Not set';
}
