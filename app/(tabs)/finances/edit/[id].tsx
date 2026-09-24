import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { DeleteRecordButton } from '@/components/DeleteRecordButton';
import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import {
  deleteTransaction,
  getTransactionById,
  updateTransaction,
} from '@/lib/db/transactions';
import type { Transaction } from '@/lib/types/finances';

const KIND_OPTIONS: Transaction['kind'][] = ['expense', 'revenue'];

const CATEGORY_SUGGESTIONS = [
  'Feed',
  'Veterinary',
  'Supplies',
  'Animal sales',
  'Equipment',
  'Other',
];

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [transactionDate, setTransactionDate] = useState('');
  const [kind, setKind] = useState<Transaction['kind']>('expense');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const tx = await getTransactionById(id);
        if (cancelled || !tx) {
          setErrorMessage('Transaction not found.');
          return;
        }
        setTransactionDate(tx.date);
        setKind(tx.kind);
        setCategory(tx.category);
        setAmount(String(tx.amount));
        setNotes(tx.notes ?? '');
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Could not load transaction.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSave() {
    if (!id) {
      return;
    }
    const parsed = Number.parseFloat(amount);
    if (!category.trim()) {
      setErrorMessage('Enter a category.');
      return;
    }
    if (Number.isNaN(parsed) || parsed <= 0) {
      setErrorMessage('Enter a valid amount.');
      return;
    }

    setSaving(true);
    setErrorMessage('');
    try {
      await updateTransaction(id, {
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
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState message="Loading transaction…" />;
  }

  return (
    <HandWriteBlocked>
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerClassName="p-4">
        <FormMessage message={errorMessage} tone="error" />

        <DateField
          label="Date"
          value={transactionDate}
          onChange={setTransactionDate}
        />

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
              <Text className="font-medium">{option}</Text>
            </Pressable>
          ))}
        </View>

        <Input label="Category" value={category} onChangeText={setCategory} />
        <View className="flex-row flex-wrap gap-2 mb-4">
          {CATEGORY_SUGGESTIONS.map((suggestion) => (
            <Pressable
              key={suggestion}
              onPress={() => setCategory(suggestion)}
              className="rounded-full border border-gray-300 bg-white px-3 py-1">
              <Text className="text-sm text-gray-700">{suggestion}</Text>
            </Pressable>
          ))}
        </View>

        <Input
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
        <Input label="Notes" value={notes} onChangeText={setNotes} />

        <Button
          title={saving ? 'Saving…' : 'Save Changes'}
          onPress={handleSave}
          disabled={saving}
        />

        <DeleteRecordButton
          confirmTitle="Delete transaction?"
          confirmMessage="This money entry will be permanently removed."
          onDelete={async () => {
            if (!id) {
              return;
            }
            await deleteTransaction(id);
            router.back();
          }}
        />
      </ScrollView>
    </HandWriteBlocked>
  );
}
