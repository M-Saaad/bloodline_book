import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { FieldLabel } from '@/components/ui/FieldLabel';
import type {
  HerdLifecycleFilter,
  HerdSexFilter,
  HerdStatusFilter,
} from '@/lib/domain/animals';

type FilterOption<T extends string> = { value: T; label: string };

type HerdFilterSheetProps = {
  visible: boolean;
  onClose: () => void;
  status: HerdStatusFilter;
  sex: HerdSexFilter;
  lifecycle: HerdLifecycleFilter;
  pastureId: string | null;
  withdrawalOnly: boolean;
  statusOptions: FilterOption<HerdStatusFilter>[];
  sexOptions: FilterOption<HerdSexFilter>[];
  lifecycleOptions: FilterOption<HerdLifecycleFilter>[];
  pastures: { id: string; name: string }[];
  onStatus: (value: HerdStatusFilter) => void;
  onSex: (value: HerdSexFilter) => void;
  onLifecycle: (value: HerdLifecycleFilter) => void;
  onPasture: (value: string | null) => void;
  onWithdrawal: (value: boolean) => void;
  onClear: () => void;
  matchCount: number;
};

export function HerdFilterSheet({
  visible,
  onClose,
  status,
  sex,
  lifecycle,
  pastureId,
  withdrawalOnly,
  statusOptions,
  sexOptions,
  lifecycleOptions,
  pastures,
  onStatus,
  onSex,
  onLifecycle,
  onPasture,
  onWithdrawal,
  onClear,
  matchCount,
}: HerdFilterSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/55 justify-end" onPress={onClose}>
        <Pressable
          onPress={() => undefined}
          className="bg-paper rounded-t-[28px] max-h-[88%]"
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
          <View className="w-11 h-1.5 rounded-full bg-gray-300 self-center mt-3 mb-3.5" />
          <View className="flex-row items-center justify-between px-5 pb-3">
            <Text className="text-2xl font-extrabold text-ink">Filters</Text>
            <Pressable
              onPress={onClear}
              accessibilityRole="button"
              className="min-h-[48px] justify-center px-2">
              <Text className="text-base text-bloodline-600 font-bold">Clear</Text>
            </Pressable>
          </View>
          <ScrollView className="px-5" contentContainerClassName="pb-2">
            <ChipGroup
              label="Status"
              options={statusOptions}
              value={status}
              onChange={onStatus}
            />
            <ChipGroup label="Sex" options={sexOptions} value={sex} onChange={onSex} />
            <ChipGroup
              label="Stage"
              options={lifecycleOptions}
              value={lifecycle}
              onChange={onLifecycle}
            />
            <FieldLabel>Pasture and health</FieldLabel>
            <View className="mb-4">
              <ChipRow>
                <Chip
                  label="Any pasture"
                  selected={pastureId == null}
                  onPress={() => onPasture(null)}
                />
                {pastures.map((pasture) => (
                  <Chip
                    key={pasture.id}
                    label={pasture.name}
                    selected={pastureId === pasture.id}
                    onPress={() => onPasture(pasture.id)}
                  />
                ))}
                <Chip
                  label="In withdrawal"
                  selected={withdrawalOnly}
                  onPress={() => onWithdrawal(!withdrawalOnly)}
                />
              </ChipRow>
            </View>
          </ScrollView>
          <View className="px-5 pt-3">
            <Button
              title={`Show ${matchCount} goat${matchCount === 1 ? '' : 's'}`}
              onPress={onClose}
              className="min-h-[60px] rounded-[18px]"
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View className="mb-4">
      <FieldLabel>{label}</FieldLabel>
      <ChipRow>
        {options.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={option.value === value}
            onPress={() => onChange(option.value)}
          />
        ))}
      </ChipRow>
    </View>
  );
}
