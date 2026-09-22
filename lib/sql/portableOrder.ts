/** Sort keys for PowerSync web SQLite (no `NULLS LAST` support). */

export const ORDER_DUE_DATE_DESC =
  '(due_date IS NULL), due_date DESC, bred_date DESC';

export const ORDER_DUE_DATE_ASC =
  '(due_date IS NULL), due_date ASC, bred_date DESC';

export const ORDER_TASKS_BY_DUE =
  'completed ASC, (due_date IS NULL), due_date ASC, created_at DESC';
