export interface Farm {
  id: string;
  name: string;
  segment: 'dairy' | 'meat' | 'both';
  currency: string;
  weightUnit: 'lb' | 'kg';
  createdAt: string;
  updatedAt: string;
}

export interface FarmMember {
  farmId: string;
  userId: string;
  role: 'owner' | 'manager' | 'hand';
  equityShare: number | null;
  createdAt: string;
}
