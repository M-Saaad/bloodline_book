export interface WeighSession {
  id: string;
  farmId: string;
  date: string;
  weighPoint:
    | 'birth'
    | '30_day'
    | '60_day'
    | '90_day'
    | 'weaning'
    | 'yearling'
    | 'ad_hoc';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WeightLog {
  id: string;
  farmId: string;
  weighSessionId: string;
  animalId: string;
  weightValue: number;
  weightUnit: 'lb' | 'kg';
  createdAt: string;
  updatedAt: string;
}
