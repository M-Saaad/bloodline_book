export type BreedingStatus =
  | 'bred'
  | 'confirmed'
  | 'open'
  | 'kidded'
  | 'dry'
  | 'lost';

export type ConfirmMethod = 'ultrasound' | 'blood_test' | 'other';

export type BreedingEvent = {
  id: string;
  farmId: string;
  damId: string;
  sireId: string | null;
  sireExternalName: string | null;
  bredDate: string;
  exposureEndDate: string | null;
  dueDate: string | null;
  dueWindowStart: string | null;
  dueWindowEnd: string | null;
  status: BreedingStatus;
  confirmedDate: string | null;
  confirmMethod: ConfirmMethod | null;
  kiddingEventId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KiddingEase = 'unassisted' | 'assisted' | 'vet';

export type KiddingEvent = {
  id: string;
  farmId: string;
  damId: string;
  sireId: string | null;
  sireExternalName: string | null;
  kidDate: string;
  kidsBorn: number;
  kidsSurviving: number | null;
  kiddingEase: KiddingEase | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};
