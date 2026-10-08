import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { FormKeyboardScreen } from '@/components/ui/FormKeyboardScreen';
import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { FormMessage } from '@/components/ui/FormMessage';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { Input } from '@/components/ui/Input';
import { Segmented } from '@/components/ui/Segmented';
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
    <FormKeyboardScreen
      contentContainerClassName="px-5 pt-2 pb-8"
      footer={
        <Button
          title={loading ? 'Saving…' : 'Save task'}
          onPress={handleSave}
          disabled={loading}
          className="min-h-[60px]"
        />
      }>
      <FormMessage message={errorMessage} tone="error" />

      <Input
        label="What needs doing?"
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

      <FieldLabel>How important?</FieldLabel>
      <View className="mb-4">
        <Segmented
          value={priority}
          onChange={setPriority}
          options={PRIORITIES.map((option) => ({
            value: option,
            label: `${option.charAt(0).toUpperCase()}${option.slice(1)}`,
          }))}
        />
      </View>
    </FormKeyboardScreen>
    </HandWriteBlocked>
  );
}
