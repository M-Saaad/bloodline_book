import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { createTask } from '@/lib/db/documents';
import type { FarmTask } from '@/lib/types/documents';
import { useFarm } from '@/providers/FarmProvider';

const PRIORITIES: FarmTask['priority'][] = ['low', 'medium', 'high'];

export default function AddTaskScreen() {
  const { activeFarm } = useFarm();
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<FarmTask['priority']>('medium');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSave() {
    if (!activeFarm) {
      return;
    }

    setErrorMessage('');
    if (!title.trim()) {
      setErrorMessage('Enter a task title.');
      return;
    }

    setLoading(true);
    try {
      await createTask(activeFarm.id, {
        title: title.trim(),
        dueDate: dueDate.trim() || undefined,
        priority,
      });
      router.back();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not save task.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (!activeFarm) {
    return null;
  }

  return (
    <HandWriteBlocked>
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="p-4">
      <FormMessage message={errorMessage} tone="error" />

      <Input
        label="Title"
        value={title}
        onChangeText={setTitle}
        placeholder="Check water troughs"
      />
      <DateField
        label="Due date"
        value={dueDate}
        onChange={setDueDate}
        optional
        placeholder="No due date"
      />

      <Text className="text-sm font-medium text-gray-700 mb-2">Priority</Text>
      <View className="flex-row gap-2 mb-6">
        {PRIORITIES.map((option) => (
          <Pressable
            key={option}
            onPress={() => setPriority(option)}
            className={`flex-1 rounded-xl border px-3 py-3 items-center capitalize ${
              priority === option
                ? 'border-bloodline-600 bg-bloodline-50'
                : 'border-gray-300 bg-white'
            }`}>
            <Text
              className={`font-medium ${
                priority === option ? 'text-bloodline-700' : 'text-gray-700'
              }`}>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>

      <Button
        title={loading ? 'Saving…' : 'Save Task'}
        onPress={handleSave}
        disabled={loading}
      />
    </ScrollView>
    </HandWriteBlocked>
  );
}
