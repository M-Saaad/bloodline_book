export interface FarmDocument {
  id: string;
  farmId: string;
  animalId: string | null;
  type:
    | 'registration'
    | 'health_certificate'
    | 'scrapie_tag'
    | 'insurance'
    | 'transfer_paper'
    | 'other';
  title: string;
  storagePath: string | null;
  notes: string | null;
  createdAt: string;
}

export interface FarmTask {
  id: string;
  farmId: string;
  title: string;
  dueDate: string | null;
  priority: 'low' | 'medium' | 'high';
  assignedTo: string | null;
  source:
    | 'manual'
    | 'health'
    | 'breeding'
    | 'weaning'
    | 'weigh_day'
    | 'famacha_check';
  sourceId: string | null;
  completed: boolean;
  createdAt: string;
}
