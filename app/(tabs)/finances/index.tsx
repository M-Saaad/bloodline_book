import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';

import { PageHeading } from '@/components/land/PageHeading';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { mapTransaction } from '@/lib/db/mappers';
import { formatDisplayDate } from '@/lib/dates';
import { formatFarmCurrency } from '@/lib/format/money';
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
      <View className="flex-1 bg-paper">
        <EmptyState title="No farm selected" />
      </View>
    );
  }

  if (isLoading) {
    return <LoadingState message="Loading transactions…" />;
  }

  const currency = activeFarm.currency;
  const formatMoney = (amount: number) => formatFarmCurrency(amount, currency);

  const header = (
    <View className="gap-3.5 pb-3.5">
      <PageHeading title="Money" subtitle="All entries" />
      <Card className="px-[18px] py-[18px]">
        <View className="flex-row">
          <View className="flex-1">
            <Text numberOfLines={1} adjustsFontSizeToFit className="text-[19px] font-extrabold text-[#0f5a33]">
              {formatMoney(revenue)}
            </Text>
            <Text className="text-[15px] font-semibold text-gray-500">In</Text>
          </View>
          <View className="flex-1">
            <Text numberOfLines={1} adjustsFontSizeToFit className="text-[19px] font-extrabold text-ink">
              {formatMoney(expenses)}
            </Text>
            <Text className="text-[15px] font-semibold text-gray-500">Out</Text>
          </View>
          <View className="flex-1">
            <Text numberOfLines={1} adjustsFontSizeToFit className="text-[19px] font-extrabold text-ink">
              {formatMoney(revenue - expenses)}
            </Text>
            <Text className="text-[15px] font-semibold text-gray-500">Left over</Text>
          </View>
        </View>
      </Card>
      <Button
        title="Add transaction"
        onPress={() => router.push('/(tabs)/finances/add')}
      />
    </View>
  );

  return (
    <View className="flex-1 bg-paper">
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-5 pt-5 pb-10"
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            title="No transactions yet"
            description="Track feed, vet bills, sales, and other farm income and expenses."
            actionLabel="Add transaction"
            onAction={() => router.push('/(tabs)/finances/add')}
          />
        }
        renderItem={({ item, index }) => {
          const isIncome = item.kind === 'revenue';
          const first = index === 0;
          const last = index === transactions.length - 1;
          return (
            <Pressable
              onPress={() => router.push(`/(tabs)/finances/edit/${item.id}`)}
              accessibilityRole="button"
              className={`flex-row items-center gap-3 min-h-[72px] px-4 py-2.5 bg-white border-x border-gray-200 active:bg-gray-50 ${
                first ? 'border-t rounded-t-[22px]' : ''
              } ${last ? 'border-b rounded-b-[22px]' : 'border-b border-b-gray-100'}`}>
              <View className="flex-1">
                <Text className="text-lg font-extrabold text-ink capitalize">
                  {item.category}
                </Text>
                <Text className="text-[15px] text-gray-500 mt-0.5" numberOfLines={2}>
                  {formatDisplayDate(item.date)}
                  {item.notes ? ` · ${item.notes}` : ''}
                </Text>
              </View>
              <Text
                className={`text-[19px] font-extrabold ${
                  isIncome ? 'text-[#0f5a33]' : 'text-ink'
                }`}>
                {isIncome ? '+ ' : '- '}
                {formatMoney(item.amount)}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
