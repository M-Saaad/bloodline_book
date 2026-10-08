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

import { Button } from '@/components/ui/Button';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { FormMessage } from '@/components/ui/FormMessage';
import { HerdRow } from '@/components/ui/HerdRow';
import { Input } from '@/components/ui/Input';
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
          wide ? 'flex-1 bg-black/55 items-center justify-center p-6' : 'flex-1 bg-paper'
        }
        style={wide ? undefined : { paddingTop: insets.top }}>
        <View
          className={wide ? 'bg-paper rounded-[28px] w-full overflow-hidden' : 'flex-1 bg-paper'}
            style={
            wide
              ? { maxWidth: 480, width: '100%', height: '80%' }
              : undefined
          }>
          <View className="flex-row items-center justify-between px-5 min-h-[64px]">
            <Text className="text-[22px] font-extrabold text-ink flex-1" numberOfLines={1}>
              {addingOutside ? 'Not in this herd' : title}
            </Text>
            <Pressable
              onPress={close}
              accessibilityRole="button"
              className="min-h-[48px] justify-center px-2">
              <Text className="text-base text-bloodline-600 font-bold">Close</Text>
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
              <View className="px-5 pt-1">
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search name, tag, or registration"
                  autoCapitalize="none"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                  className="border border-gray-300 rounded-[18px] px-4 h-14 text-lg bg-white text-ink"
                  placeholderTextColor="#8a7b75"
                />
                {quickChips.length > 0 ? (
                  <View className="mt-3">
                    <ChipRow>
                      {quickChips.map((item) => (
                        <Chip
                          key={item.id}
                          label={item.label}
                          selected={chipId === item.id}
                          onPress={() =>
                            setChipId((current) => (current === item.id ? null : item.id))
                          }
                        />
                      ))}
                    </ChipRow>
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
                    className="min-h-[48px] justify-center">
                    <Text className="text-base text-bloodline-600 font-bold">
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
                contentContainerClassName="px-5 py-3"
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
                        <Text className="text-[15px] font-bold text-gray-500 mt-2 mb-2">
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
                className="border-t border-gray-200 px-5 pt-3 bg-white"
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
                  <Button
                    title={`${selectedIds.length} selected · Done`}
                    onPress={close}
                    className="min-h-[60px] rounded-[18px]"
                  />
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
        <Text className="text-lg font-extrabold text-ink text-center">
          No goats yet
        </Text>
        <Text className="text-base text-gray-500 text-center mt-2">{emptyMessage}</Text>
      </View>
    );
  }
  return (
    <View className="py-8">
      <Text className="text-lg font-extrabold text-ink text-center">
        {query.trim()
          ? `No goat matches “${query.trim()}”`
          : 'No goats match this filter'}
      </Text>
      {query.trim() ? (
        <Pressable onPress={onClearQuery} className="min-h-[48px] items-center justify-center mt-2">
          <Text className="text-base text-bloodline-600 font-bold">Clear search</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function FooterButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="min-h-[56px] justify-center border border-gray-300 rounded-[18px] px-4 mb-2 bg-white active:bg-gray-50">
      <Text className="text-[17px] text-ink font-bold text-center">{label}</Text>
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
    <View className="px-5 pb-4 pt-1">
      <Text className="text-base text-gray-500 mb-4">
        {sex === 'female'
          ? 'This doe stays off Weigh Day and the herd list.'
          : 'This buck stays off Weigh Day and the herd list.'}
      </Text>
      <Input label="Name" value={name} onChangeText={setName} />
      <FieldLabel>Registry</FieldLabel>
      <View className="mb-4">
        <ChipRow>
          {REGISTRATION_BODY_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={registrationBody === option.value}
              onPress={() =>
                setRegistrationBody((current) =>
                  current === option.value ? null : option.value,
                )
              }
            />
          ))}
        </ChipRow>
      </View>
      <Input
        label="Registration number"
        value={registrationNumber}
        onChangeText={setRegistrationNumber}
      />
      <Input label="Breed" value={breedName} onChangeText={setBreedName} />
      <FormMessage message={error} />
      <Button
        title={saving ? 'Saving…' : 'Save and choose'}
        onPress={handleSave}
        disabled={saving}
        className="min-h-[60px] rounded-[18px]"
      />
      <Pressable onPress={onCancel} accessibilityRole="button" className="min-h-[48px] items-center justify-center mt-2">
        <Text className="text-base text-gray-500 font-bold">Back to the list</Text>
      </Pressable>
    </View>
  );
}
