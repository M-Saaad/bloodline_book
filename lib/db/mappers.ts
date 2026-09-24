import type { BreedingEvent, KiddingEvent } from '@/lib/types/breeding';
import type { Animal, Breed } from '@/lib/types/animals';
import type { HealthRecord } from '@/lib/types/health';
import type { FarmDocument, FarmTask } from '@/lib/types/documents';
import type { Transaction } from '@/lib/types/finances';
import type { FarmInvite } from '@/lib/types/team';
import type { FeedLog, GrazingRecord, Pasture } from '@/lib/types/land';
import type { Farm, FarmMember } from '@/lib/types/tenancy';
import type { WeighSession, WeightLog } from '@/lib/types/weight';

export function mapFarm(row: Record<string, unknown>): Farm {
  return {
    id: String(row.id),
    name: String(row.name),
    segment: row.segment as Farm['segment'],
    currency: String(row.currency ?? 'USD'),
    weightUnit: (row.weight_unit as Farm['weightUnit']) ?? 'lb',
    gestationDays:
      row.gestation_days != null ? Number(row.gestation_days) : 150,
    weaningDays:
      row.weaning_days === undefined
        ? 90
        : row.weaning_days != null
          ? Number(row.weaning_days)
          : null,
    famachaRecheckDays:
      row.famacha_recheck_days != null
        ? Number(row.famacha_recheck_days)
        : 14,
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
    officialId:
      row.official_id != null ? String(row.official_id) : null,
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
    updatedAt: String(row.updated_at ?? row.created_at),
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
    updatedAt: String(row.updated_at ?? row.created_at),
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
    updatedAt: String(row.updated_at ?? row.created_at),
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
    updatedAt: String(row.updated_at ?? row.created_at),
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
    updatedAt: String(row.updated_at ?? row.created_at),
  };
}

export function mapHealthRecord(row: Record<string, unknown>): HealthRecord {
  return {
    id: String(row.id),
    farmId: String(row.farm_id),
    animalId: String(row.animal_id),
    date: String(row.date),
    kind: row.kind as HealthRecord['kind'],
    famachaScore:
      row.famacha_score != null ? Number(row.famacha_score) : null,
    productName:
      row.product_name != null ? String(row.product_name) : null,
    dosage: row.dosage != null ? String(row.dosage) : null,
    withdrawalDays:
      row.withdrawal_days != null ? Number(row.withdrawal_days) : null,
    meatWithdrawalDays:
      row.meat_withdrawal_days != null
        ? Number(row.meat_withdrawal_days)
        : null,
    milkWithdrawalDays:
      row.milk_withdrawal_days != null
        ? Number(row.milk_withdrawal_days)
        : null,
    route: (row.route as HealthRecord['route']) ?? null,
    lotNumber: row.lot_number != null ? String(row.lot_number) : null,
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at ?? row.created_at),
  };
}

export function mapBreedingEvent(row: Record<string, unknown>): BreedingEvent {
  return {
    id: String(row.id),
    farmId: String(row.farm_id),
    damId: String(row.dam_id),
    sireId: row.sire_id != null ? String(row.sire_id) : null,
    sireExternalName:
      row.sire_external_name != null ? String(row.sire_external_name) : null,
    bredDate: String(row.bred_date),
    exposureEndDate:
      row.exposure_end_date != null ? String(row.exposure_end_date) : null,
    dueDate: row.due_date != null ? String(row.due_date) : null,
    dueWindowStart:
      row.due_window_start != null ? String(row.due_window_start) : null,
    dueWindowEnd:
      row.due_window_end != null ? String(row.due_window_end) : null,
    status: row.status as BreedingEvent['status'],
    confirmedDate:
      row.confirmed_date != null ? String(row.confirmed_date) : null,
    confirmMethod: (row.confirm_method as BreedingEvent['confirmMethod']) ?? null,
    kiddingEventId:
      row.kidding_event_id != null ? String(row.kidding_event_id) : null,
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapPasture(row: Record<string, unknown>): Pasture {
  return {
    id: String(row.id),
    farmId: String(row.farm_id),
    name: String(row.name),
    acres: row.acres != null ? Number(row.acres) : null,
    forageType: row.forage_type as Pasture['forageType'],
    status: row.status as Pasture['status'],
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapGrazingRecord(row: Record<string, unknown>): GrazingRecord {
  return {
    id: String(row.id),
    farmId: String(row.farm_id),
    pastureId: String(row.pasture_id),
    animalId: String(row.animal_id),
    startDate: String(row.start_date),
    endDate: row.end_date != null ? String(row.end_date) : null,
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at ?? row.created_at),
  };
}

export function mapFeedLog(row: Record<string, unknown>): FeedLog {
  return {
    id: String(row.id),
    farmId: String(row.farm_id),
    date: String(row.date),
    feedType: String(row.feed_type),
    quantity: row.quantity != null ? Number(row.quantity) : null,
    unit: row.unit as FeedLog['unit'],
    pastureId: row.pasture_id != null ? String(row.pasture_id) : null,
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at ?? row.created_at),
  };
}

export function mapKiddingEvent(row: Record<string, unknown>): KiddingEvent {
  return {
    id: String(row.id),
    farmId: String(row.farm_id),
    damId: String(row.dam_id),
    sireId: row.sire_id != null ? String(row.sire_id) : null,
    sireExternalName:
      row.sire_external_name != null ? String(row.sire_external_name) : null,
    kidDate: String(row.kid_date),
    kidsBorn: Number(row.kids_born),
    kidsSurviving:
      row.kids_surviving != null ? Number(row.kids_surviving) : null,
    kiddingEase: (row.kidding_ease as KiddingEvent['kiddingEase']) ?? null,
    notes: row.notes != null ? String(row.notes) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
