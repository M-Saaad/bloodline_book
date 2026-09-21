import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView } from 'react-native';

import { AnimalSelectField } from '@/components/ui/AnimalSelectField';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { todayIso } from '@/lib/dates';
import { createKiddingEvent } from '@/lib/db/breeding';
import { mapAnimal } from '@/lib/db/mappers';
import { useFarm } from '@/providers/FarmProvider';

export default function AddKiddingScreen() {
  const { activeFarm } = useFarm();
  const [damId, setDamId] = useState<string | null>(null);
  const [sireId, setSireId] = useState<string | null>(null);
  const [sireExternalName, setSireExternalName] = useState('');
  const [kidDate, setKidDate] = useState(todayIso);
  const [kidsBorn, setKidsBorn] = useState('1');
  const [kidsSurviving, setKidsSurviving] = useState('');
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
