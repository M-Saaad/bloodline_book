import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { FormKeyboardScreen } from '@/components/ui/FormKeyboardScreen';

import { DeleteRecordButton } from '@/components/DeleteRecordButton';
import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { Button } from '@/components/ui/Button';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { Segmented } from '@/components/ui/Segmented';
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

const KIND_OPTIONS: { value: Transaction['kind']; label: string }[] = [
  { value: 'expense', label: 'Spent' },
  { value: 'revenue', label: 'Received' },
];

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
      <FormKeyboardScreen
        contentContainerClassName="px-5 pt-2 pb-6"
        footer={
          <Button
            className="min-h-[60px]"
            title={saving ? 'Saving…' : 'Save changes'}
            onPress={handleSave}
            disabled={saving}
          />
        }>
        <FormMessage message={errorMessage} tone="error" />

        <View className="mb-4">
          <FieldLabel>Money</FieldLabel>
          <Segmented options={KIND_OPTIONS} value={kind} onChange={setKind} />
        </View>

        <Input
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />

        <View className="mb-4">
          <FieldLabel>What for?</FieldLabel>
          <ChipRow>
            {CATEGORY_SUGGESTIONS.map((suggestion) => (
              <Chip
                key={suggestion}
                label={suggestion}
                selected={category === suggestion}
                onPress={() => setCategory(suggestion)}
              />
            ))}
          </ChipRow>
        </View>

        <Input label="Category" value={category} onChangeText={setCategory} />

        <DateField
          label="Date"
          value={transactionDate}
          onChange={setTransactionDate}
        />

        <Input label="Notes" optional multiline value={notes} onChangeText={setNotes} />

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
      </FormKeyboardScreen>
    </HandWriteBlocked>
  );
}
