import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { DeleteRecordButton } from '@/components/DeleteRecordButton';
import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListCard, Chevron } from '@/components/ui/ListRow';
import { LoadingState } from '@/components/ui/LoadingState';
import { formatDisplayDate } from '@/lib/dates';
import { deleteWeighSession } from '@/lib/db/weights';
import { useFarm } from '@/providers/FarmProvider';
import { Text } from '@/components/ui/Text';

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
      <View className="flex-1 bg-paper">
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
        className="flex-1 bg-paper"
        contentContainerClassName="px-5 pt-3 pb-8 gap-3.5">
        <Card className="px-[18px] py-4">
          <Text className="text-2xl font-extrabold text-ink">
            {formatDisplayDate(String(session.date))}
          </Text>
          <View className="flex-row mt-2">
            <Badge
              label={String(session.weigh_point)
                .replace(/_/g, ' ')
                .replace(/^./, (c) => c.toUpperCase())}
              tone="brand"
            />
          </View>
          {session.notes ? (
            <Text className="text-base text-gray-500 mt-2.5">{String(session.notes)}</Text>
          ) : null}
        </Card>

        <Text className="text-xl font-extrabold text-ink">
          Weights ({logs.length})
        </Text>
        {logs.length === 0 ? (
          <Text className="text-base text-gray-500">No weights in this session.</Text>
        ) : (
          <ListCard>
            {logs.map((row, index) => {
              const log = row as Record<string, unknown>;
              const name = log.name != null ? String(log.name) : null;
              const tag = log.tag_number != null ? String(log.tag_number) : null;
              return (
                <Pressable
                  key={String(log.id)}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push(`/(tabs)/livestock/weight-log/${String(log.id)}`)
                  }
                  className="active:bg-gray-50">
                  <View
                    className={`flex-row items-center gap-3 min-h-[64px] px-4 py-2.5 ${
                      index === logs.length - 1 ? '' : 'border-b border-gray-100'
                    }`}>
                    <Text className="flex-1 text-lg font-extrabold text-ink" numberOfLines={1}>
                      {name ?? (tag ? '' : 'Unnamed')}
                      {tag ? (
                        <Text className="text-bloodline-600">
                          {name ? ' ' : ''}#{tag}
                        </Text>
                      ) : null}
                    </Text>
                    <Text className="text-[19px] font-extrabold text-ink">
                      {String(log.weight_value)} {String(log.weight_unit)}
                    </Text>
                    <Chevron />
                  </View>
                </Pressable>
              );
            })}
          </ListCard>
        )}

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
