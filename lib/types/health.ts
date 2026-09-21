export type HealthRecordKind =
  | 'vaccination'
  | 'treatment'
  | 'famacha'
  | 'deworming'
  | 'injury'
  | 'hoof_trim'
  | 'other';

export type HealthRecord = {
  id: string;
  farmId: string;
  animalId: string;
  date: string;
  kind: HealthRecordKind;
  famachaScore: number | null;
  productName: string | null;
  dosage: string | null;
  withdrawalDays: number | null;
  notes: string | null;
  createdAt: string;
};
