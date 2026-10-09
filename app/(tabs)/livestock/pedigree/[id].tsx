import { useQuery } from '@powersync/react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { FarmWriteGate } from '@/components/FarmWriteGate';
import { PedigreeTree } from '@/components/livestock/PedigreeTree';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Text } from '@/components/ui/Text';
import {
  buildPedigree,
  FULL_PEDIGREE_GENERATIONS,
  PEDIGREE_HERD_SQL,
  pedigreeAnimalFromRow,
} from '@/lib/domain/pedigree';
import { useFarm } from '@/providers/FarmProvider';

const BOX_WIDTH = 156;

export default function PedigreeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeFarm } = useFarm();

  const { data: herdRows, isLoading } = useQuery(
    activeFarm ? PEDIGREE_HERD_SQL : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const herd = useMemo(
    () => (herdRows ?? []).map((row) => pedigreeAnimalFromRow(row as Record<string, unknown>)),
    [herdRows],
  );
  const subject = herd.find((animal) => animal.id === id);
  const pedigree = useMemo(
    () => (id ? buildPedigree(id, herd, FULL_PEDIGREE_GENERATIONS) : null),
    [id, herd],
  );

  if (!activeFarm || !id) {
    return null;
  }

  if (isLoading) {
    return <LoadingState message="Loading pedigree…" />;
  }

  if (!subject || !pedigree) {
    return (
      <View className="flex-1 bg-paper">
        <EmptyState
          title="Goat not found"
          description="This goat may have been removed or is not on this farm."
          actionLabel="Back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const title = subject.name ?? (subject.tagNumber ? `#${subject.tagNumber}` : 'Pedigree');

  return (
    <View className="flex-1 bg-paper">
      <Stack.Screen options={{ title: `${title} · Pedigree` }} />
      <ScrollView contentContainerClassName="pb-12">
        <View className="px-5 pt-4 pb-2">
          <Text className="text-[15px] text-gray-500">
            {pedigree.knownCount === 0
              ? 'No parents are recorded for this goat yet.'
              : 'Sire above, dam below. Tap a goat to open it. Scroll sideways to see older generations.'}
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerClassName="px-5 py-3">
          <PedigreeTree
            pedigree={pedigree}
            boxWidth={BOX_WIDTH}
            subject={{
              name: subject.name,
              tagNumber: subject.tagNumber,
              registrationNumber: subject.registrationNumber,
            }}
          />
        </ScrollView>
        <View className="px-5 pt-3 gap-3">
          <Text className="text-[13px] text-gray-500">
            Built from the dam and sire on each goat in your herd. A parent that isn&apos;t
            in your herd ends its line.
          </Text>
          <FarmWriteGate>
            <Button
              title="Edit parents"
              variant="outline"
              onPress={() => router.push(`/(tabs)/livestock/edit/${id}`)}
            />
          </FarmWriteGate>
        </View>
      </ScrollView>
    </View>
  );
}
