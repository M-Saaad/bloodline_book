import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { DeleteRecordButton } from '@/components/DeleteRecordButton';
import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { deleteWeighSession } from '@/lib/db/weights';
import { useFarm } from '@/providers/FarmProvider';

export default function WeighSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeFarm } = useFarm();

  const { data: sessionRow, isLoading: sessionLoading } = useQuery(
    id ? 'SELECT * FROM weigh_sessions WHERE id = ?' : 'SELECT 1 WHERE 0',
    id ? [id] : [],
  );

  const { data: logRows, isLoading: logsLoading } = useQuery(
    id
      ? `SELECT wl.*, a.name, a.tag_number
         FROM weight_logs wl
         LEFT JOIN animals a ON a.id = wl.animal_id
         WHERE wl.weigh_session_id = ?
         ORDER BY wl.created_at`
      : 'SELECT 1 WHERE 0',
    id ? [id] : [],
  );

  if (!activeFarm || !id) {
    return null;
  }

  if (sessionLoading || logsLoading) {
    return <LoadingState message="Loading weigh session…" />;
  }

  const session = sessionRow?.[0];
  if (!session) {
    return (
      <View className="flex-1 bg-gray-50">
        <EmptyState
          title="Session not found"
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const logs = logRows ?? [];

  return (
    <HandWriteBlocked>
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerClassName="p-4 gap-4 pb-8">
        <Card>
          <Text className="text-xl font-bold text-gray-900">
            {String(session.date)}
          </Text>
          <Text className="text-gray-600 capitalize mt-1">
            {String(session.weigh_point).replace(/_/g, ' ')}
          </Text>
          {session.notes ? (
            <Text className="text-gray-600 mt-2">{String(session.notes)}</Text>
          ) : null}
        </Card>

        <Card>
          <Text className="text-lg font-semibold text-gray-900 mb-3">
            Weights ({logs.length})
          </Text>
          {logs.length === 0 ? (
            <Text className="text-gray-500">No weights in this session.</Text>
          ) : (
            logs.map((row) => {
              const log = row as Record<string, unknown>;
              const label =
                log.name != null
                  ? String(log.name)
                  : log.tag_number != null
                    ? `Tag ${String(log.tag_number)}`
                    : 'Unnamed';
              return (
                <Pressable
                  key={String(log.id)}
                  onPress={() =>
                    router.push(`/(tabs)/livestock/weight-log/${String(log.id)}`)
                  }
                  className="flex-row justify-between py-3 border-b border-gray-100">
                  <Text className="text-gray-800 font-medium">{label}</Text>
                  <Text className="text-gray-900 font-semibold">
                    {String(log.weight_value)} {String(log.weight_unit)}
                  </Text>
                </Pressable>
              );
            })
          )}
        </Card>

        <DeleteRecordButton
          title="Delete whole session"
          confirmTitle="Delete weigh session?"
          confirmMessage="All weights in this session will be permanently deleted."
          onDelete={async () => {
            await deleteWeighSession(id);
            router.back();
          }}
        />
      </ScrollView>
    </HandWriteBlocked>
  );
}
