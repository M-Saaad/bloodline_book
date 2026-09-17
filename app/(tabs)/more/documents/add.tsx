import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { createDocument } from '@/lib/db/documents';
import type { FarmDocument } from '@/lib/types/documents';
import { useFarm } from '@/providers/FarmProvider';

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
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="p-4">
      <FormMessage message={errorMessage} tone="error" />

      <Text className="text-sm font-medium text-gray-700 mb-2">Type</Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {DOCUMENT_TYPES.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => setType(option.value)}
            className={`rounded-full border px-3 py-1.5 ${
              type === option.value
                ? 'border-bloodline-600 bg-bloodline-50'
                : 'border-gray-300 bg-white'
            }`}>
            <Text
              className={`text-sm ${
                type === option.value
                  ? 'text-bloodline-700 font-medium'
                  : 'text-gray-700'
              }`}>
              {option.label}
            </Text>
          </Pressable>
        ))}
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
      />

      <Text className="text-sm text-gray-500 mb-4">
        File upload arrives in a later phase. Metadata is saved now.
      </Text>

      <Button
        title={loading ? 'Saving…' : 'Save Document'}
        onPress={handleSave}
        disabled={loading}
      />
    </ScrollView>
  );
}
