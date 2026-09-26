import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';

import { HerdRow } from '@/components/ui/HerdRow';
import {
  formatLivestockRowTitle,
  REGISTRATION_BODY_OPTIONS,
} from '@/lib/domain/animals';
import { saveOutsideAnimal } from '@/lib/storage/barn-memory';
import type { Animal } from '@/lib/types/animals';
import {
  buildPickerRows,
  formatOutsideAnimalLabel,
  herdRowSubtitle,
  UNKNOWN_PARENT_LABEL,
  visibleAnimalIds,
  type OutsideAnimal,
  type PickerBlock,
  type PickerRow,
} from '@/lib/ui/animal-picker';

export type PickerQuickChip = {
  id: string;
  label: string;
  match: (animal: Animal) => boolean;
};

type AnimalPickerModalProps = {
  visible: boolean;
  title: string;
  animals: Animal[];
  mode: 'single' | 'multi';
  selectedIds: string[];
  onClose: () => void;
  onSelectAnimal: (animalId: string) => void;
  onChangeSelected: (animalIds: string[]) => void;
  onClear?: () => void;
  onUnknown?: () => void;
  onOutside: (animal: OutsideAnimal) => void;
  allowClear: boolean;
  allowUnknown: boolean;
  allowOutside: boolean;
  outsideSex: Animal['sex'];
  outsideAnimals: OutsideAnimal[];
  recentIds: string[];
  exclude: PickerBlock[];
  disabled: PickerBlock[];
  quickChips: PickerQuickChip[];
  pastureByAnimalId: Record<string, string | undefined>;
  breedById: Record<string, string | undefined>;
  suggestedIds: string[];
  emptyMessage: string;
  farmId: string | null;
  onOutsideListChange: (animals: OutsideAnimal[]) => void;
};

export function AnimalPickerModal({
  visible,
  title,
  animals,
  mode,
  selectedIds,
  onClose,
  onSelectAnimal,
  onChangeSelected,
  onClear,
  onUnknown,
  onOutside,
  allowClear,
  allowUnknown,
  allowOutside,
  outsideSex,
  outsideAnimals,
  recentIds,
  exclude,
  disabled,
  quickChips,
  pastureByAnimalId,
  breedById,
  suggestedIds,
  emptyMessage,
  farmId,
  onOutsideListChange,
}: AnimalPickerModalProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= 900;
  const [query, setQuery] = useState('');
  const [chipId, setChipId] = useState<string | null>(null);
  const [addingOutside, setAddingOutside] = useState(false);

  const chip = quickChips.find((item) => item.id === chipId)?.match ?? null;
  const rows = useMemo(
    () =>
      buildPickerRows({
        animals,
        outsideAnimals: outsideAnimals.filter(
          (animal) => !allowOutside || animal.sex === outsideSex,
        ),
        query,
        recentIds,
        suggestedIds,
        chip,
        exclude,
        disabled,
        includeOutside: allowOutside,
      }),
    [
      allowOutside,
      animals,
      chip,
      disabled,
      exclude,
      outsideAnimals,
      outsideSex,
      query,
      recentIds,
      suggestedIds,
    ],
  );

  function close() {
    setQuery('');
    setChipId(null);
    setAddingOutside(false);
    onClose();
  }

  function subtitleFor(animal: Animal): string {
    const parts = [
      herdRowSubtitle(animal, {
        breed: animal.breedPrimaryId
          ? breedById[animal.breedPrimaryId]
          : null,
        pasture: pastureByAnimalId[animal.id],
      }),
    ];
    if (animal.status !== 'active') {
      parts.push(animal.status.replace(/_/g, ' '));
    }
    return parts.filter(Boolean).join(' · ');
  }

  const shownIds = visibleAnimalIds(rows);
  const allShownSelected =
    shownIds.length > 0 && shownIds.every((id) => selectedIds.includes(id));

  return (
    <Modal
      visible={visible}
      animationType={wide ? 'fade' : 'slide'}
      transparent={wide}
      onRequestClose={close}>
      <View
        className={
          wide ? 'flex-1 bg-black/40 items-center justify-center p-6' : 'flex-1 bg-white'
        }
        style={wide ? undefined : { paddingTop: insets.top }}>
        <View
          className={wide ? 'bg-white rounded-2xl w-full overflow-hidden' : 'flex-1 bg-white'}
            style={
            wide
              ? { maxWidth: 480, width: '100%', height: '80%' }
              : undefined
          }>
          <View className="flex-row items-center justify-between px-4 min-h-[52px] border-b border-gray-200">
            <Text className="text-lg font-semibold text-gray-900 flex-1" numberOfLines={1}>
              {addingOutside ? 'Not in this herd' : title}
            </Text>
            <Pressable
              onPress={close}
              accessibilityRole="button"
              className="min-h-[44px] justify-center px-2">
              <Text className="text-bloodline-700 font-semibold">Close</Text>
            </Pressable>
          </View>

          {addingOutside && farmId ? (
            <OutsideAnimalForm
              sex={outsideSex}
              onCancel={() => setAddingOutside(false)}
              onSave={async (draft) => {
                const created: OutsideAnimal = {
                  ...draft,
                  id: Crypto.randomUUID(),
                  sex: outsideSex,
                };
                const next = await saveOutsideAnimal(farmId, created);
                onOutsideListChange(next);
                onOutside(created);
                close();
              }}
            />
          ) : (
            <>
              <View className="px-4 pt-3">
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search name, tag, or registration"
                  autoCapitalize="none"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                  className="border border-gray-300 rounded-xl px-4 min-h-[48px] text-base bg-white text-gray-900"
                  placeholderTextColor="#4b5563"
                />
                {quickChips.length > 0 ? (
                  <View className="flex-row flex-wrap gap-2 mt-3">
                    {quickChips.map((item) => {
                      const selected = chipId === item.id;
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() =>
                            setChipId((current) => (current === item.id ? null : item.id))
                          }
                          className={`min-h-[44px] justify-center rounded-full px-4 ${
                            selected ? 'bg-bloodline-600' : 'bg-white border border-gray-300'
                          }`}>
                          <Text
                            className={`font-semibold ${
                              selected ? 'text-white' : 'text-gray-900'
                            }`}>
                            {item.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
                {mode === 'multi' && shownIds.length > 0 ? (
                  <Pressable
                    onPress={() => {
                      if (allShownSelected) {
                        onChangeSelected(
                          selectedIds.filter((id) => !shownIds.includes(id)),
                        );
                        return;
                      }
                      onChangeSelected([...new Set([...selectedIds, ...shownIds])]);
                    }}
                    className="min-h-[44px] justify-center">
                    <Text className="text-bloodline-700 font-semibold">
                      {allShownSelected ? 'Clear everyone shown' : 'Select everyone shown'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              <FlatList
                data={rows}
                keyExtractor={(row) => rowKey(row)}
                keyboardShouldPersistTaps="handled"
                style={{ flex: 1 }}
                contentContainerClassName="px-4 py-3"
                ListEmptyComponent={
                  <EmptyPicker
                    herdEmpty={animals.length === 0}
                    query={query}
                    emptyMessage={emptyMessage}
                    onClearQuery={() => setQuery('')}
                  />
                }
                renderItem={({ item }) => {
                  switch (item.kind) {
                    case 'header':
                      return (
                        <Text className="text-sm font-semibold text-gray-700 mt-2 mb-2">
                          {item.title}
                        </Text>
                      );
                    case 'animal':
                      return (
                        <HerdRow
                          title={formatLivestockRowTitle(item.animal)}
                          subtitle={subtitleFor(item.animal)}
                          selected={selectedIds.includes(item.animal.id)}
                          onPress={() => {
                            if (mode === 'single') {
                              onSelectAnimal(item.animal.id);
                              close();
                              return;
                            }
                            toggleId(selectedIds, item.animal.id, onChangeSelected);
                          }}
                        />
                      );
                    case 'outside':
                      return (
                        <HerdRow
                          title={formatOutsideAnimalLabel(item.outside)}
                          subtitle="Not in this herd"
                          onPress={() => {
                            onOutside(item.outside);
                            close();
                          }}
                        />
                      );
                    case 'excluded':
                      return (
                        <HerdRow
                          title={formatLivestockRowTitle(item.animal)}
                          subtitle={item.reason}
                          disabled
                        />
                      );
                    default: {
                      const _exhaustive: never = item;
                      return _exhaustive;
                    }
                  }
                }}
              />

              <View
                className="border-t border-gray-200 px-4 pt-2 bg-white"
                style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
                {allowUnknown && onUnknown ? (
                  <FooterButton
                    label={UNKNOWN_PARENT_LABEL}
                    onPress={() => {
                      onUnknown();
                      close();
                    }}
                  />
                ) : null}
                {allowOutside && farmId ? (
                  <FooterButton
                    label={
                      outsideSex === 'female'
                        ? 'Add a doe who is not in this herd'
                        : 'Add a buck who is not in this herd'
                    }
                    onPress={() => setAddingOutside(true)}
                  />
                ) : null}
                {allowClear && onClear ? (
                  <FooterButton
                    label="Not set"
                    onPress={() => {
                      onClear();
                      close();
                    }}
                  />
                ) : null}
                {mode === 'multi' ? (
                  <Pressable
                    onPress={close}
                    className="min-h-[48px] rounded-xl bg-bloodline-600 items-center justify-center mt-1">
                    <Text className="text-white font-semibold text-base">
                      {selectedIds.length} selected · Done
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function rowKey(row: PickerRow): string {
  switch (row.kind) {
    case 'header':
      return row.id;
    case 'animal':
      return `animal-${row.section}-${row.animal.id}`;
    case 'excluded':
      return `excluded-${row.animal.id}`;
    case 'outside':
      return `outside-${row.outside.id}`;
    default: {
      const _exhaustive: never = row;
      return _exhaustive;
    }
  }
}

function toggleId(
  selectedIds: string[],
  animalId: string,
  onChange: (ids: string[]) => void,
) {
  if (selectedIds.includes(animalId)) {
    onChange(selectedIds.filter((id) => id !== animalId));
    return;
  }
  onChange([...selectedIds, animalId]);
}

function EmptyPicker({
  herdEmpty,
  query,
  emptyMessage,
  onClearQuery,
}: {
  herdEmpty: boolean;
  query: string;
  emptyMessage: string;
  onClearQuery: () => void;
}) {
  if (herdEmpty && !query.trim()) {
    return (
      <View className="py-8">
        <Text className="text-lg font-semibold text-gray-900 text-center">
          No goats yet
        </Text>
        <Text className="text-gray-700 text-center mt-2">{emptyMessage}</Text>
      </View>
    );
  }
  return (
    <View className="py-8">
      <Text className="text-lg font-semibold text-gray-900 text-center">
        {query.trim()
          ? `No goat matches “${query.trim()}”`
          : 'No goats match this filter'}
      </Text>
      {query.trim() ? (
        <Pressable onPress={onClearQuery} className="min-h-[44px] items-center justify-center mt-2">
          <Text className="text-bloodline-700 font-semibold">Clear search</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function FooterButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="min-h-[48px] justify-center border border-gray-300 rounded-xl px-3 mb-2 bg-white">
      <Text className="text-gray-900 font-semibold text-center">{label}</Text>
    </Pressable>
  );
}

function OutsideAnimalForm({
  sex,
  onCancel,
  onSave,
}: {
  sex: Animal['sex'];
  onCancel: () => void;
  onSave: (animal: Omit<OutsideAnimal, 'id' | 'sex'>) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [registrationBody, setRegistrationBody] =
    useState<Animal['registrationBody']>(null);
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [breedName, setBreedName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!name.trim()) {
      setError('Enter a name.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        name: name.trim(),
        registrationBody,
        registrationNumber: registrationNumber.trim() || null,
        breedName: breedName.trim() || null,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save.');
      setSaving(false);
    }
  }

  return (
    <View className="p-4 gap-3">
      <Text className="text-gray-700">
        {sex === 'female'
          ? 'This doe stays off Weigh Day and the herd list.'
          : 'This buck stays off Weigh Day and the herd list.'}
      </Text>
      <Field label="Name" value={name} onChangeText={setName} />
      <Text className="text-sm font-medium text-gray-700">Registry</Text>
      <View className="flex-row flex-wrap gap-2">
        {REGISTRATION_BODY_OPTIONS.map((option) => {
          const selected = registrationBody === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() =>
                setRegistrationBody((current) =>
                  current === option.value ? null : option.value,
                )
              }
              className={`min-h-[44px] justify-center rounded-full px-4 ${
                selected ? 'bg-bloodline-600' : 'bg-white border border-gray-300'
              }`}>
              <Text className={`font-semibold ${selected ? 'text-white' : 'text-gray-900'}`}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Field
        label="Registration number"
        value={registrationNumber}
        onChangeText={setRegistrationNumber}
      />
      <Field label="Breed" value={breedName} onChangeText={setBreedName} />
      {error ? <Text className="text-red-800">{error}</Text> : null}
      <Pressable
        onPress={handleSave}
        disabled={saving}
        className="min-h-[48px] rounded-xl bg-bloodline-600 items-center justify-center">
        <Text className="text-white font-semibold">
          {saving ? 'Saving…' : 'Save and choose'}
        </Text>
      </Pressable>
      <Pressable onPress={onCancel} className="min-h-[44px] items-center justify-center">
        <Text className="text-gray-900 font-semibold">Back to the list</Text>
      </Pressable>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View>
      <Text className="text-sm font-medium text-gray-700 mb-1">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        className="border border-gray-300 rounded-xl px-4 min-h-[48px] text-base bg-white text-gray-900"
        placeholderTextColor="#4b5563"
      />
    </View>
  );
}
