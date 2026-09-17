import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { FlatList, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { mapDocument } from '@/lib/db/mappers';
import { useFarm } from '@/providers/FarmProvider';

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
    return <LoadingState message="Loading documents…" />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 py-3">
        <Button
          title="Add Document"
          onPress={() => router.push('/(tabs)/more/documents/add')}
        />
      </View>

      <FlatList
        data={documents}
        keyExtractor={(item) => item.id}
        contentContainerClassName={
          documents.length === 0 ? 'flex-grow' : 'px-4 pb-6'
        }
        ListEmptyComponent={
          <EmptyState
            title="No documents yet"
            description="Track registrations, health certificates, and other farm paperwork."
            actionLabel="Add Document"
            onAction={() => router.push('/(tabs)/more/documents/add')}
          />
        }
        renderItem={({ item }) => (
          <View className="bg-white border border-gray-200 rounded-xl p-4 mb-2">
            <View className="flex-row justify-between items-start mb-1">
              <Text className="text-lg font-semibold text-gray-900 flex-1 pr-2">
                {item.title}
              </Text>
              <Badge label={item.type.replace(/_/g, ' ')} />
            </View>
            {item.notes ? (
              <Text className="text-gray-500 text-sm">{item.notes}</Text>
            ) : null}
          </View>
        )}
      />
    </View>
  );
}
