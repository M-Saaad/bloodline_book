import type { Transaction } from '@/lib/types/finances';

export function formatTransactionKind(kind: Transaction['kind']): string {
  switch (kind) {
    case 'expense':
      return 'Expense';
    case 'revenue':
      return 'Income';
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
