export interface FarmInvite {
  id: string;
  farmId: string;
  email: string;
  role: 'manager' | 'hand';
  status: 'pending' | 'accepted' | 'revoked';
  createdAt: string;
}
