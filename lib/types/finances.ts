export interface Transaction {
  id: string;
  farmId: string;
  date: string;
  amount: number;
  kind: 'expense' | 'revenue';
  category: string;
  notes: string | null;
  createdAt: string;
}
