export interface Breed {
  id: string;
  farmId: string | null;
  name: string;
  segment: 'dairy' | 'meat' | 'both';
}

export interface Animal {
  id: string;
  farmId: string;
  name: string | null;
  tagNumber: string | null;
  officialId: string | null;
  photoStoragePath: string | null;
  breedPrimaryId: string | null;
  breedPercentage: number | null;
  sex: 'male' | 'female';
  dateOfBirth: string | null;
  status: 'active' | 'sold' | 'died' | 'slaughtered' | 'transferred';
  lifecycleStage:
    | 'kid'
    | 'weaned'
    | 'yearling'
    | 'breeding'
    | 'feeder'
    | 'market_ready'
    | 'adult';
  purpose: 'dairy' | 'meat' | 'breeding_stock' | null;
  damId: string | null;
  sireId: string | null;
  sireExternalName: string | null;
  litterId: string | null;
  registrationBody: 'adga' | 'abga' | 'usbga' | 'other' | null;
  registrationNumber: string | null;
  tattoo: string | null;
  purchasePrice: number | null;
  soldPrice: number | null;
  purchasedFromId: string | null;
  outDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
