import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { FlatList, View } from 'react-native';

import { CardRowShell } from '@/components/breeding/parts';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListRow } from '@/components/ui/ListRow';
import { LoadingState } from '@/components/ui/LoadingState';
import { mapDocument } from '@/lib/db/mappers';
import { useFarm } from '@/providers/FarmProvider';
import { Text } from '@/components/ui/Text';

export default function DocumentsScreen() {
  const { activeFarm } = useFarm();

  const { data, isLoading } = useQuery(
    activeFarm
      ? `SELECT * FROM documents
         WHERE farm_id = ?
         ORDER BY created_at DESC`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const documents = (data ?? []).map((row) =>
    mapDocument(row as Record<string, unknown>),
  );

  if (!activeFarm) {
    return null;
  }

  if (isLoading) {
    return <LoadingState message="Loading papers…" />;
  }

  return (
    <View className="flex-1 bg-paper">
      <View className="px-5 pt-2 pb-3 items-end">
        <Button
          title="＋ Add"
          className="w-[104px] min-h-[48px] py-0"
          onPress={() => router.push('/(tabs)/more/documents/add')}
        />
      </View>

      <FlatList
        data={documents}
        keyExtractor={(item) => item.id}
        contentContainerClassName={
          documents.length === 0 ? 'flex-grow' : 'px-5 pb-10'
        }
        ListEmptyComponent={
          <EmptyState
            title="No papers yet"
            description="Track registrations, health certificates, and other farm paperwork."
            actionLabel="Add paper"
            onAction={() => router.push('/(tabs)/more/documents/add')}
          />
        }
        ListFooterComponent={
          documents.length > 0 ? (
            <Text className="text-[15px] leading-[21px] text-gray-500 mt-4">
              Photos of papers are coming later. For now, write down where each one is kept.
            </Text>
          ) : null
        }
        renderItem={({ item, index }) => {
          const typeLabel = item.type.replace(/_/g, ' ');
          const label = `${typeLabel.charAt(0).toUpperCase()}${typeLabel.slice(1)}`;
          return (
            <CardRowShell index={index} count={documents.length}>
              <ListRow
                title={item.title}
                subtitle={item.notes || label}
                last={index === documents.length - 1}
                right={<Badge label={label} tone={item.type === 'registration' ? 'brand' : 'default'} />}
              />
            </CardRowShell>
          );
        }}
      />
    </View>
  );
}
