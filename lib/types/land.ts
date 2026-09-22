export type PastureStatus = 'grazing' | 'resting' | 'hay' | 'overgrazed';

export type ForageType =
  | 'mixed'
  | 'bermuda'
  | 'clover'
  | 'browse'
  | 'hayfield'
  | 'other';

export type FeedUnit = 'lb' | 'kg' | 'bale' | 'bag';

export interface Pasture {
  id: string;
  farmId: string;
  name: string;
  acres: number | null;
  forageType: ForageType;
  status: PastureStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GrazingRecord {
  id: string;
  farmId: string;
  pastureId: string;
  animalId: string;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  createdAt: string;
}

export interface FeedLog {
  id: string;
  farmId: string;
  date: string;
  feedType: string;
  quantity: number | null;
  unit: FeedUnit;
  pastureId: string | null;
  notes: string | null;
  createdAt: string;
}
