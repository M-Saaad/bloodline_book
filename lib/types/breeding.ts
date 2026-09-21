export type BreedingStatus = 'bred' | 'confirmed' | 'open' | 'kidded' | 'dry';

export type BreedingEvent = {
  id: string;
  farmId: string;
  damId: string;
  sireId: string | null;
  sireExternalName: string | null;
  bredDate: string;
  dueDate: string | null;
  status: BreedingStatus;
  kiddingEventId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KiddingEvent = {
  id: string;
  farmId: string;
  damId: string;
  sireId: string | null;
  sireExternalName: string | null;
  kidDate: string;
  kidsBorn: number;
  kidsSurviving: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};
