import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
      <Pressable className="flex-1 bg-black/40 justify-end" onPress={onClose}>
        <Pressable
          onPress={() => undefined}
          className="bg-white rounded-t-3xl max-h-[85%]"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
          <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
            <Text className="text-lg font-semibold text-gray-900">Filters</Text>
            <Pressable onPress={onClear} className="min-h-[44px] justify-center px-2">
              <Text className="text-bloodline-700 font-semibold">Clear</Text>
            </Pressable>
          </View>
          <ScrollView className="px-4" contentContainerClassName="pb-2">
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
            <Text className="text-sm font-semibold text-gray-900 mb-2">Pasture</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              <FilterChip
                label="Any pasture"
                selected={pastureId == null}
                onPress={() => onPasture(null)}
              />
              {pastures.map((pasture) => (
                <FilterChip
                  key={pasture.id}
                  label={pasture.name}
                  selected={pastureId === pasture.id}
                  onPress={() => onPasture(pasture.id)}
                />
              ))}
            </View>
            <Text className="text-sm font-semibold text-gray-900 mb-2">Health</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              <FilterChip
                label="In withdrawal"
                selected={withdrawalOnly}
                onPress={() => onWithdrawal(!withdrawalOnly)}
              />
            </View>
          </ScrollView>
          <View className="px-4 pt-2">
            <Pressable
              onPress={onClose}
              className="min-h-[48px] rounded-xl bg-bloodline-600 items-center justify-center">
              <Text className="text-white font-semibold text-base">
                Show {matchCount} goat{matchCount === 1 ? '' : 's'}
              </Text>
            </Pressable>
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
      <Text className="text-sm font-semibold text-gray-900 mb-2">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => (
          <FilterChip
            key={option.value}
            label={option.label}
            selected={option.value === value}
            onPress={() => onChange(option.value)}
          />
        ))}
      </View>
    </View>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`min-h-[44px] justify-center rounded-full px-4 ${
        selected ? 'bg-bloodline-600' : 'bg-white border border-gray-300'
      }`}>
      <Text className={`font-semibold ${selected ? 'text-white' : 'text-gray-900'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
