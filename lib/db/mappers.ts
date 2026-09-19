import type { Animal, Breed } from '@/lib/types/animals';
import type { FarmDocument, FarmTask } from '@/lib/types/documents';
import type { Transaction } from '@/lib/types/finances';
import type { FarmInvite } from '@/lib/types/team';
import type { Farm, FarmMember } from '@/lib/types/tenancy';
import type { WeighSession, WeightLog } from '@/lib/types/weight';

export function mapFarm(row: Record<string, unknown>): Farm {
  return {
    id: String(row.id),
    name: String(row.name),
    segment: row.segment as Farm['segment'],
    currency: String(row.currency ?? 'USD'),
    weightUnit: (row.weight_unit as Farm['weightUnit']) ?? 'lb',
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapFarmMember(row: Record<string, unknown>): FarmMember {
  return {
    farmId: String(row.farm_id),
    userId: String(row.user_id),
    role: row.role as FarmMember['role'],
    equityShare: row.equity_share != null ? Number(row.equity_share) : null,
    createdAt: String(row.created_at),
  };
}

export function mapBreed(row: Record<string, unknown>): Breed {
  return {
    id: String(row.id),
    farmId: row.farm_id != null ? String(row.farm_id) : null,
    name: String(row.name),
    segment: row.segment as Breed['segment'],
  };
}

export function mapAnimal(row: Record<string, unknown>): Animal {
  return {
    id: String(row.id),
    farmId: String(row.farm_id),
    name: row.name != null ? String(row.name) : null,
    tagNumber: row.tag_number != null ? String(row.tag_number) : null,
    photoStoragePath:
      row.photo_storage_path != null ? String(row.photo_storage_path) : null,
    breedPrimaryId:
      row.breed_primary_id != null ? String(row.breed_primary_id) : null,
    breedPercentage:
      row.breed_percentage != null ? Number(row.breed_percentage) : null,
    sex: row.sex as Animal['sex'],
    dateOfBirth:
      row.date_of_birth != null ? String(row.date_of_birth) : null,
    status: row.status as Animal['status'],
    lifecycleStage: row.lifecycle_stage as Animal['lifecycleStage'],
    purpose: row.purpose as Animal['purpose'],
    damId: row.dam_id != null ? String(row.dam_id) : null,
    sireId: row.sire_id != null ? String(row.sire_id) : null,
    sireExternalName:
      row.sire_external_name != null ? String(row.sire_external_name) : null,
    litterId: row.litter_id != null ? String(row.litter_id) : null,
    registrationBody: row.registration_body as Animal['registrationBody'],
    registrationNumber:
      row.registration_number != null
        ? String(row.registration_number)
        : null,
    tattoo: row.tattoo != null ? String(row.tattoo) : null,
    purchasePrice:
      row.purchase_price != null ? Number(row.purchase_price) : null,
    soldPrice: row.sold_price != null ? Number(row.sold_price) : null,
    purchasedFromId:
      row.purchased_from_id != null ? String(row.purchased_from_id) : null,
    outDate: row.out_date != null ? String(row.out_date) : null,
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapWeighSession(row: Record<string, unknown>): WeighSession {
  return {
    id: String(row.id),
    farmId: String(row.farm_id),
    date: String(row.date),
    weighPoint: row.weigh_point as WeighSession['weighPoint'],
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: String(row.created_at),
  };
}

export function mapWeightLog(row: Record<string, unknown>): WeightLog {
  return {
    id: String(row.id),
    farmId: String(row.farm_id),
    weighSessionId: String(row.weigh_session_id),
    animalId: String(row.animal_id),
    weightValue: Number(row.weight_value),
    weightUnit: row.weight_unit as WeightLog['weightUnit'],
    createdAt: String(row.created_at),
  };
}

export function mapTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: String(row.id),
    farmId: String(row.farm_id),
    date: String(row.date),
    amount: Number(row.amount),
    kind: row.kind as Transaction['kind'],
    category: String(row.category),
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: String(row.created_at),
  };
}

export function mapFarmInvite(row: Record<string, unknown>): FarmInvite {
  return {
    id: String(row.id),
    farmId: String(row.farm_id),
    email: String(row.email),
    role: row.role as FarmInvite['role'],
    status: row.status as FarmInvite['status'],
    createdAt: String(row.created_at),
  };
}

export function mapDocument(row: Record<string, unknown>): FarmDocument {
  return {
    id: String(row.id),
    farmId: String(row.farm_id),
    animalId: row.animal_id != null ? String(row.animal_id) : null,
    type: row.type as FarmDocument['type'],
    title: String(row.title),
    storagePath:
      row.storage_path != null ? String(row.storage_path) : null,
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: String(row.created_at),
  };
}

export function mapTask(row: Record<string, unknown>): FarmTask {
  return {
    id: String(row.id),
    farmId: String(row.farm_id),
    title: String(row.title),
    dueDate: row.due_date != null ? String(row.due_date) : null,
    priority: row.priority as FarmTask['priority'],
    assignedTo: row.assigned_to != null ? String(row.assigned_to) : null,
    source: row.source as FarmTask['source'],
    sourceId: row.source_id != null ? String(row.source_id) : null,
    completed: Boolean(row.completed),
    createdAt: String(row.created_at),
  };
}
