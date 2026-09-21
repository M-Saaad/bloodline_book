import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { todayIso } from '@/lib/dates';
import { createTransaction } from '@/lib/db/transactions';
import type { Transaction } from '@/lib/types/finances';
import { useFarm } from '@/providers/FarmProvider';

const KIND_OPTIONS: Transaction['kind'][] = ['expense', 'revenue'];

const CATEGORY_SUGGESTIONS = [
  'Feed',
  'Veterinary',
  'Supplies',
  'Animal sales',
  'Milk sales',
  'Equipment',
  'Other',
];

export default function AddTransactionScreen() {
  const { activeFarm } = useFarm();
  const [transactionDate, setTransactionDate] = useState(todayIso);
  const [kind, setKind] = useState<Transaction['kind']>('expense');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSave() {
    if (!activeFarm) {
      return;
    }

    setErrorMessage('');
    const parsed = Number.parseFloat(amount);
    if (!category.trim()) {
      setErrorMessage('Enter a category.');
      return;
    }
    if (Number.isNaN(parsed) || parsed <= 0) {
      setErrorMessage('Enter a valid amount greater than zero.');
      return;
    }

    setLoading(true);
    try {
      await createTransaction(activeFarm.id, {
        date: transactionDate,
        amount: parsed,
        kind,
        category: category.trim(),
        notes: notes.trim() || undefined,
      });
      router.back();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not save transaction.',
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

      <DateField
        label="Date"
        value={transactionDate}
        onChange={setTransactionDate}
        maximumDate={new Date()}
      />
      <Text className="text-sm text-gray-600 mb-4">
        Currency: {activeFarm.currency}
      </Text>

      <Text className="text-sm font-medium text-gray-700 mb-2">Type</Text>
      <View className="flex-row gap-2 mb-4">
        {KIND_OPTIONS.map((option) => (
          <Pressable
            key={option}
            onPress={() => setKind(option)}
            className={`flex-1 rounded-xl border px-3 py-3 items-center capitalize ${
              kind === option
                ? 'border-bloodline-600 bg-bloodline-50'
                : 'border-gray-300 bg-white'
            }`}>
            <Text
              className={`font-medium ${
                kind === option ? 'text-bloodline-700' : 'text-gray-700'
              }`}>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>

      <Input
        label="Category"
        value={category}
        onChangeText={setCategory}
        placeholder="Feed"
      />

      <Text className="text-sm font-medium text-gray-700 mb-2">Suggestions</Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {CATEGORY_SUGGESTIONS.map((suggestion) => (
          <Pressable
            key={suggestion}
            onPress={() => setCategory(suggestion)}
            className={`rounded-full border px-3 py-1.5 ${
              category === suggestion
                ? 'border-bloodline-600 bg-bloodline-50'
                : 'border-gray-300 bg-white'
            }`}>
            <Text
              className={`text-sm ${
                category === suggestion
                  ? 'text-bloodline-700 font-medium'
                  : 'text-gray-700'
              }`}>
              {suggestion}
            </Text>
          </Pressable>
        ))}
      </View>

      <Input
        label="Amount"
        value={amount}
        onChangeText={setAmount}
        placeholder="0.00"
        keyboardType="decimal-pad"
      />

      <Input
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        placeholder="Optional"
      />

      <Button
        title={loading ? 'Saving…' : 'Save Transaction'}
        onPress={handleSave}
        disabled={loading}
      />
    </ScrollView>
  );
}
