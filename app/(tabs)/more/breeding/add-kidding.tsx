import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { AnimalSelectField } from '@/components/ui/AnimalSelectField';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { todayIso } from '@/lib/dates';
import { createKiddingEvent, type KiddingKidDraft } from '@/lib/db/breeding';
import { mapAnimal } from '@/lib/db/mappers';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';
import { useFarm } from '@/providers/FarmProvider';

export default function AddKiddingScreen() {
  const { activeFarm } = useFarm();
  const [damId, setDamId] = useState<string | null>(null);
  const [sireId, setSireId] = useState<string | null>(null);
  const [sireExternalName, setSireExternalName] = useState('');
  const [kidDate, setKidDate] = useState(todayIso);
  const [kidsBorn, setKidsBorn] = useState('1');
  const [kidsSurviving, setKidsSurviving] = useState('');
  const [registerKids, setRegisterKids] = useState(false);
  const [kidDrafts, setKidDrafts] = useState<KiddingKidDraft[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { data: animalRows } = useQuery(
    activeFarm
      ? `SELECT * FROM animals
         WHERE farm_id = ? AND status = 'active'
         ORDER BY COALESCE(name, tag_number, id)`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const animals = useMemo(
    () => (animalRows ?? []).map((row) => mapAnimal(row as Record<string, unknown>)),
    [animalRows],
  );

  const females = useMemo(
    () => animals.filter((animal) => animal.sex === 'female'),
    [animals],
  );

  const males = useMemo(
    () => animals.filter((animal) => animal.sex === 'male'),
    [animals],
  );

  const bornCount = Number.parseInt(kidsBorn, 10);

  useEffect(() => {
    if (!registerKids || Number.isNaN(bornCount) || bornCount < 1) {
      setKidDrafts([]);
      return;
    }
    const count = Math.min(bornCount, 12);
    setKidDrafts((prev) => {
      const next: KiddingKidDraft[] = [];
      for (let i = 0; i < count; i++) {
        next.push(prev[i] ?? { sex: 'female' });
      }
      return next;
    });
  }, [registerKids, bornCount]);

  function setKidSex(index: number, sex: 'male' | 'female') {
    setKidDrafts((prev) =>
      prev.map((kid, i) => (i === index ? { ...kid, sex } : kid)),
    );
  }

  async function handleSave() {
    if (!activeFarm) {
      return;
    }

    setErrorMessage('');
    if (!damId) {
      setErrorMessage('Select a dam.');
      return;
    }

    const born = Number.parseInt(kidsBorn, 10);
    if (Number.isNaN(born) || born < 0) {
      setErrorMessage('Enter a valid number of kids born.');
      return;
    }

    let surviving: number | undefined;
    if (kidsSurviving.trim()) {
      const parsed = Number.parseInt(kidsSurviving, 10);
      if (Number.isNaN(parsed) || parsed < 0) {
        setErrorMessage('Enter a valid surviving count.');
        return;
      }
      surviving = parsed;
    }

    const dam = females.find((animal) => animal.id === damId);
    const damLabel = dam ? animalDisplayLabel(dam) : 'Dam';

    setLoading(true);
    try {
      await createKiddingEvent(activeFarm.id, {
        damId,
        sireId: sireId ?? undefined,
        sireExternalName: sireExternalName.trim() || undefined,
        kidDate,
        kidsBorn: born,
        kidsSurviving: surviving,
        notes: notes.trim() || undefined,
        damLabel,
        registerKids: registerKids ? kidDrafts : undefined,
      });
      router.back();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not save kidding.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (!activeFarm) {
    return null;
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="p-4">
      <FormMessage message={errorMessage} tone="error" />

      <AnimalSelectField
        label="Dam"
        animals={females}
        value={damId}
        onChange={setDamId}
      />

      <AnimalSelectField
        label="Sire (on farm)"
        animals={males}
        value={sireId}
        onChange={setSireId}
        emptyMessage="Optional — use external sire name below if off-farm."
      />

      <Input
        label="External sire name"
        value={sireExternalName}
        onChangeText={setSireExternalName}
        placeholder="Optional"
      />

      <DateField label="Kid date" value={kidDate} onChange={setKidDate} />

      <Input
        label="Kids born"
        value={kidsBorn}
        onChangeText={setKidsBorn}
        keyboardType="numeric"
      />
      <Input
        label="Kids surviving"
        value={kidsSurviving}
        onChangeText={setKidsSurviving}
        keyboardType="numeric"
        placeholder="Optional"
      />

      <Pressable
        onPress={() => setRegisterKids((value) => !value)}
        className="flex-row items-center gap-2 mb-3">
        <View
          className={`w-5 h-5 rounded border ${
            registerKids
              ? 'bg-bloodline-600 border-bloodline-600'
              : 'border-gray-400 bg-white'
          }`} />
        <Text className="text-gray-800">Register kids in herd (links litter)</Text>
      </Pressable>

      {registerKids && kidDrafts.length > 0 ? (
        <View className="mb-4 gap-3">
          {kidDrafts.map((kid, index) => (
            <View
              key={index}
              className="bg-white border border-gray-200 rounded-xl p-3">
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Kid {index + 1}
              </Text>
              <View className="flex-row gap-2">
                {(['female', 'male'] as const).map((sex) => (
                  <Pressable
                    key={sex}
                    onPress={() => setKidSex(index, sex)}
                    className={`flex-1 rounded-lg border py-2 items-center ${
                      kid.sex === sex
                        ? 'border-bloodline-600 bg-bloodline-50'
                        : 'border-gray-300'
                    }`}>
                    <Text
                      className={
                        kid.sex === sex
                          ? 'text-bloodline-700 font-medium capitalize'
                          : 'text-gray-700 capitalize'
                      }>
                      {sex}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <Input
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        placeholder="Optional"
      />

      <Button
        title={loading ? 'Saving…' : 'Save Kidding'}
        onPress={handleSave}
        disabled={loading}
      />
    </ScrollView>
  );
}
