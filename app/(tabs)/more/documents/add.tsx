import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { FormKeyboardScreen } from '@/components/ui/FormKeyboardScreen';
import { Button } from '@/components/ui/Button';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { createDocument } from '@/lib/db/documents';
import type { FarmDocument } from '@/lib/types/documents';
import { useFarm } from '@/providers/FarmProvider';
import { Text } from '@/components/ui/Text';

const DOCUMENT_TYPES: { value: FarmDocument['type']; label: string }[] = [
  { value: 'registration', label: 'Registration' },
  { value: 'health_certificate', label: 'Health certificate' },
  { value: 'scrapie_tag', label: 'Scrapie tag' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'transfer_paper', label: 'Transfer paper' },
  { value: 'other', label: 'Other' },
];

export default function AddDocumentScreen() {
  const { activeFarm } = useFarm();
  const [type, setType] = useState<FarmDocument['type']>('other');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSave() {
    if (!activeFarm) {
      return;
    }

    setErrorMessage('');
    if (!title.trim()) {
      setErrorMessage('Enter a document title.');
      return;
    }

    setLoading(true);
    try {
      await createDocument(activeFarm.id, {
        type,
        title: title.trim(),
        notes: notes.trim() || undefined,
      });
      router.back();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not save document.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (!activeFarm) {
    return null;
  }

  return (
    <FormKeyboardScreen
      contentContainerClassName="px-5 pt-2 pb-8"
      footer={
        <Button
          title={loading ? 'Saving…' : 'Save paper'}
          onPress={handleSave}
          disabled={loading}
          className="min-h-[60px]"
        />
      }>
      <FormMessage message={errorMessage} tone="error" />

      <FieldLabel>What kind?</FieldLabel>
      <View className="mb-4">
        <ChipRow>
          {DOCUMENT_TYPES.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={type === option.value}
              onPress={() => setType(option.value)}
            />
          ))}
        </ChipRow>
      </View>

      <Input
        label="Title"
        value={title}
        onChangeText={setTitle}
        placeholder="ADGA registration"
      />
      <Input
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        placeholder="Optional"
        optional
        multiline
      />

      <Text className="text-[15px] leading-[21px] text-gray-500 mb-4">
        Photos are coming later. Note where the paper is kept.
      </Text>
    </FormKeyboardScreen>
  );
}
