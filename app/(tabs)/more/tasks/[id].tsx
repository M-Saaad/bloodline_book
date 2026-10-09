import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { DeleteRecordButton } from '@/components/DeleteRecordButton';
import { HandWriteBlocked } from '@/components/HandWriteBlocked';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { FormMessage } from '@/components/ui/FormMessage';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { FormKeyboardScreen } from '@/components/ui/FormKeyboardScreen';
import { Input } from '@/components/ui/Input';
import { Segmented } from '@/components/ui/Segmented';
import { LoadingState } from '@/components/ui/LoadingState';
import {
  deleteTask,
  getTaskById,
  setTaskCompleted,
  updateTask,
} from '@/lib/db/documents';
import { useFarmRole } from '@/hooks/useFarmRole';
import type { FarmTask } from '@/lib/types/documents';
import { Text } from '@/components/ui/Text';

const PRIORITIES: FarmTask['priority'][] = ['low', 'medium', 'high'];

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { canWrite } = useFarmRole();
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<FarmTask['priority']>('medium');

  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const task = await getTaskById(id);
        if (cancelled || !task) {
          setErrorMessage('Task not found.');
          return;
        }
        setTitle(task.title);
        setDueDate(task.dueDate ?? '');
        setPriority(task.priority);
        setCompleted(task.completed);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Could not load task.',
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
    if (!id || !title.trim()) {
      setErrorMessage('Enter a title.');
      return;
    }

    setSaving(true);
    setErrorMessage('');
    try {
      await updateTask(id, {
        title: title.trim(),
        dueDate: dueDate || undefined,
        priority,
      });
      router.back();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not save task.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleCompleted() {
    if (!id || !canWrite) {
      return;
    }
    const next = !completed;
    setCompleted(next);
    await setTaskCompleted(id, next);
  }

  if (loading) {
    return <LoadingState message="Loading task…" />;
  }

  return (
    <HandWriteBlocked>
      <FormKeyboardScreen
        contentContainerClassName="px-5 pt-2 pb-8"
        footer={
          <Button
            title={saving ? 'Saving…' : 'Save changes'}
            onPress={handleSave}
            disabled={saving}
            className="min-h-[60px]"
          />
        }>
        <FormMessage message={errorMessage} tone="error" />
        <Pressable
          onPress={toggleCompleted}
          accessibilityRole="button"
          accessibilityLabel={completed ? 'Mark task incomplete' : 'Mark task done'}
          className="flex-row items-center gap-3.5 bg-white border border-gray-200 rounded-[22px] px-4 py-3.5 min-h-[72px] mb-4">
          <View
            className={`w-12 h-12 rounded-full border-[3px] items-center justify-center ${
              completed
                ? 'border-[#0f5a33] bg-[#0f5a33]'
                : 'border-bloodline-600 bg-white'
            }`}>
            {completed ? (
              <Text className="text-white text-2xl font-extrabold">✓</Text>
            ) : null}
          </View>
          <Text className="text-lg font-extrabold text-ink">
            {completed ? 'Done' : 'Mark as done'}
          </Text>
        </Pressable>
        <Input label="Title" value={title} onChangeText={setTitle} />
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
        <DeleteRecordButton
          title="Delete task"
          confirmTitle="Delete task?"
          confirmMessage="This task will be permanently removed."
          onDelete={async () => {
            if (!id) {
              return;
            }
            await deleteTask(id);
            router.back();
          }}
        />
      </FormKeyboardScreen>
    </HandWriteBlocked>
  );
}
