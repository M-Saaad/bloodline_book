import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { FormKeyboardScreen } from '@/components/ui/FormKeyboardScreen';
import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { Button } from '@/components/ui/Button';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { Segmented } from '@/components/ui/Segmented';
import { DateField } from '@/components/ui/DateField';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { todayIso } from '@/lib/dates';
import { createTransaction } from '@/lib/db/transactions';
import { formatFarmCurrency } from '@/lib/format/money';
import type { Transaction } from '@/lib/types/finances';
import { useFarm } from '@/providers/FarmProvider';
import { Text } from '@/components/ui/Text';

const KIND_OPTIONS: { value: Transaction['kind']; label: string }[] = [
  { value: 'expense', label: 'Spent' },
  { value: 'revenue', label: 'Received' },
];

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

  const parsedPreview = Number.parseFloat(amount);
  const amountPreview =
    !Number.isNaN(parsedPreview) && parsedPreview > 0
      ? formatFarmCurrency(parsedPreview, activeFarm.currency)
      : null;

  return (
    <HandWriteBlocked>
      <FormKeyboardScreen
        contentContainerClassName="px-5 pt-2 pb-6"
        footer={
          <Button
            className="min-h-[60px]"
            title={loading ? 'Saving…' : 'Save transaction'}
            onPress={handleSave}
            disabled={loading}
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
          placeholder="0.00"
          keyboardType="decimal-pad"
          hint={
            amountPreview
              ? `Preview: ${kind === 'expense' ? '−' : '+'}${amountPreview} (${activeFarm.currency})`
              : `Amounts use your farm currency (${activeFarm.currency}).`
          }
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

        <Input
          label="Category"
          hint="Tap a choice above, or type your own."
          value={category}
          onChangeText={setCategory}
          placeholder="Feed"
        />

        <DateField
          label="Date"
          value={transactionDate}
          onChange={setTransactionDate}
          maximumDate={new Date()}
        />

        <Input
          label="Notes"
          optional
          multiline
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional"
        />
      </FormKeyboardScreen>
    </HandWriteBlocked>
  );
}
