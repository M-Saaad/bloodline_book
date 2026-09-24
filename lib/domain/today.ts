import { addDaysToIso } from '@/lib/dates';

export type TodayTask = {
  id: string;
  dueDate: string | null;
  source: string;
  completed: boolean;
};

export function partitionOpenTasks<T extends TodayTask>(
  tasks: T[],
  today: string,
): { dueNow: T[]; famachaSoon: T[]; comingWeek: T[] } {
  const weekEnd = addDaysToIso(today, 7);
  const famachaEnd = addDaysToIso(today, 3);
  const dueNow: T[] = [];
  const famachaSoon: T[] = [];
  const comingWeek: T[] = [];

  for (const task of tasks) {
    if (task.completed || !task.dueDate || !weekEnd || !famachaEnd) {
      continue;
    }
    const due = task.dueDate;
    const famachaRecheck = task.source === 'famacha_check';
    if (famachaRecheck && due >= today && due <= famachaEnd) {
      famachaSoon.push(task);
      continue;
    }
    if (due <= today) {
      dueNow.push(task);
      continue;
    }
    if (due <= weekEnd) {
      comingWeek.push(task);
    }
  }

  const byDue = (a: T, b: T) =>
    (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
  dueNow.sort(byDue);
  famachaSoon.sort(byDue);
  comingWeek.sort(byDue);
  return { dueNow, famachaSoon, comingWeek };
}

export function hideOldCompletedTask(
  completed: boolean,
  updatedAt: string,
  today: string,
): boolean {
  if (!completed) {
    return false;
  }
  const cutoff = addDaysToIso(today, -30);
  if (!cutoff) {
    return false;
  }
  return updatedAt.slice(0, 10) < cutoff;
}
