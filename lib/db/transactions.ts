import * as Crypto from 'expo-crypto';

import { mapTransaction } from '@/lib/db/mappers';
import { dbNow } from '@/lib/db/now';
import { powersync } from '@/lib/powersync/system';
import type { Transaction } from '@/lib/types/finances';

export async function createTransaction(
  farmId: string,
  input: {
    date: string;
    amount: number;
    kind: Transaction['kind'];
    category: string;
    notes?: string;
  },
): Promise<string> {
  const id = Crypto.randomUUID();
  const now = dbNow();

  await powersync.execute(
    `INSERT INTO transactions (
      id, farm_id, date, amount, kind, category, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      farmId,
      input.date,
      input.amount,
      input.kind,
      input.category,
      input.notes ?? null,
      now,
      now,
    ],
  );

  return id;
}

export async function getTransactionById(
  transactionId: string,
): Promise<Transaction | null> {
  const row = await powersync.getOptional<Record<string, unknown>>(
    'SELECT * FROM transactions WHERE id = ?',
    [transactionId],
  );
  return row ? mapTransaction(row) : null;
}

export async function updateTransaction(
  transactionId: string,
  input: {
    date: string;
    amount: number;
    kind: Transaction['kind'];
    category: string;
    notes?: string;
  },
): Promise<void> {
  const now = dbNow();
  await powersync.execute(
    `UPDATE transactions SET
      date = ?, amount = ?, kind = ?, category = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.date,
      input.amount,
      input.kind,
      input.category,
      input.notes ?? null,
      now,
      transactionId,
    ],
  );
}

export async function deleteTransaction(transactionId: string): Promise<void> {
  await powersync.execute('DELETE FROM transactions WHERE id = ?', [
    transactionId,
  ]);
}

export async function getTransactionsForFarm(
  farmId: string,
): Promise<Transaction[]> {
  const rows = await powersync.getAll<Record<string, unknown>>(
    `SELECT * FROM transactions
     WHERE farm_id = ?
     ORDER BY date DESC, created_at DESC`,
    [farmId],
  );
  return rows.map(mapTransaction);
}
