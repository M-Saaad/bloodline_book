import * as Crypto from 'expo-crypto';

import { mapTransaction } from '@/lib/db/mappers';
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
  const now = new Date().toISOString();

  await powersync.execute(
    `INSERT INTO transactions (
      id, farm_id, date, amount, kind, category, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      farmId,
      input.date,
      input.amount,
      input.kind,
      input.category,
      input.notes ?? null,
      now,
    ],
  );

  return id;
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
