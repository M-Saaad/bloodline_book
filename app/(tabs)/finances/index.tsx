import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { mapTransaction } from '@/lib/db/mappers';
import { useFarm } from '@/providers/FarmProvider';

export default function FinancesScreen() {
  const { activeFarm } = useFarm();

  const { data, isLoading } = useQuery(
    activeFarm
      ? `SELECT * FROM transactions
         WHERE farm_id = ?
         ORDER BY date DESC, created_at DESC`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const transactions = (data ?? []).map((row) =>
    mapTransaction(row as Record<string, unknown>),
  );

  const revenue = transactions
    .filter((t) => t.kind === 'revenue')
    .reduce((sum, t) => sum + t.amount, 0);
  const expenses = transactions
    .filter((t) => t.kind === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  if (!activeFarm) {
    return (
      <View className="flex-1 bg-gray-50">
        <EmptyState title="No farm selected" />
      </View>
    );
  }

  if (isLoading) {
    return <LoadingState message="Loading transactions…" />;
  }

  const currency = activeFarm.currency;

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 py-3">
        <Card className="mb-3">
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-600">Revenue</Text>
            <Text className="text-green-700 font-semibold">
              {currency} {revenue.toFixed(2)}
            </Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-600">Expenses</Text>
            <Text className="text-red-700 font-semibold">
              {currency} {expenses.toFixed(2)}
            </Text>
          </View>
          <View className="flex-row justify-between pt-2 border-t border-gray-100">
            <Text className="text-gray-900 font-medium">Net</Text>
            <Text className="text-gray-900 font-bold">
              {currency} {(revenue - expenses).toFixed(2)}
            </Text>
          </View>
        </Card>
        <Button
          title="Add Transaction"
          onPress={() => router.push('/(tabs)/finances/add')}
        />
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        contentContainerClassName={
          transactions.length === 0 ? 'flex-grow' : 'px-4 pb-6'
        }
        ListEmptyComponent={
          <EmptyState
            title="No transactions yet"
            description="Track feed, vet bills, sales, and other farm income and expenses."
            actionLabel="Add Transaction"
            onAction={() => router.push('/(tabs)/finances/add')}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(tabs)/finances/edit/${item.id}`)}
            className="bg-white border border-gray-200 rounded-xl p-4 mb-2">
            <View className="flex-row justify-between items-start mb-1">
              <Text className="text-lg font-semibold text-gray-900 capitalize">
                {item.category}
              </Text>
              <Badge
                label={item.kind}
                tone={item.kind === 'revenue' ? 'success' : 'warning'}
              />
            </View>
            <View className="flex-row justify-between">
              <Text className="text-gray-500">{item.date}</Text>
              <Text
                className={`font-semibold ${
                  item.kind === 'revenue' ? 'text-green-700' : 'text-red-700'
                }`}>
                {item.kind === 'revenue' ? '+' : '-'}
                {currency} {item.amount.toFixed(2)}
              </Text>
            </View>
            {item.notes ? (
              <Text className="text-gray-500 text-sm mt-2">{item.notes}</Text>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}
