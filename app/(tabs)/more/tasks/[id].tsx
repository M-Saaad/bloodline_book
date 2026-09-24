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
  deleteTask,
  getTaskById,
  setTaskCompleted,
  updateTask,
} from '@/lib/db/documents';
import { useFarmRole } from '@/hooks/useFarmRole';
import type { FarmTask } from '@/lib/types/documents';

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
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerClassName="p-4">
        <FormMessage message={errorMessage} tone="error" />
        <Pressable
          onPress={toggleCompleted}
          className={`w-10 h-10 rounded-full border-2 mb-4 items-center justify-center ${
            completed
              ? 'border-green-600 bg-green-600'
              : 'border-gray-400 bg-white'
          }`}>
          {completed ? (
            <Text className="text-white font-bold">✓</Text>
          ) : null}
        </Pressable>
        <Input label="Title" value={title} onChangeText={setTitle} />
        <DateField
          label="Due date"
          value={dueDate}
          onChange={setDueDate}
          optional
        />
        <Text className="text-sm font-medium text-gray-700 mb-2">Priority</Text>
        <View className="flex-row gap-2 mb-4">
          {PRIORITIES.map((option) => (
            <Pressable
              key={option}
              onPress={() => setPriority(option)}
              className={`flex-1 rounded-xl border py-3 items-center capitalize ${
                priority === option
                  ? 'border-bloodline-600 bg-bloodline-50'
                  : 'border-gray-300 bg-white'
              }`}>
              <Text className="font-medium">{option}</Text>
            </Pressable>
          ))}
        </View>
        <Button
          title={saving ? 'Saving…' : 'Save Changes'}
          onPress={handleSave}
          disabled={saving}
        />
        <DeleteRecordButton
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
      </ScrollView>
    </HandWriteBlocked>
  );
}
