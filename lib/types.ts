export const LEDGER_CATEGORIES = [
  "Feed",
  "Delivery",
  "Vet/Medicine",
  "Labor",
  "Infrastructure",
  "Livestock Purchase",
  "Livestock Sale",
  "Other",
] as const;

export type LedgerCategory = (typeof LEDGER_CATEGORIES)[number];
/** Any ledger category name — built-in or user-defined. */
export type CategoryName = LedgerCategory | (string & {});
export type AnimalStatus = "Active" | "Died" | "Sold" | "Slaughtered" | "Gone";
export type AnimalSex = "Male" | "Female";
/** Free-text breed — use SUGGESTED_BREEDS for defaults in UI. */
export type AnimalBreed = string;

export const SUGGESTED_BREEDS = [
  "Nigerian Dwarf",
  "Nubian",
  "LaMancha",
  "Alpine",
  "Saanen",
  "Boer",
] as const;
export type ContactType = "Vendor" | "Customer" | "Farm";
export type TransactionKind = "cost" | "income";
export type MedicalEventType =
  | "Vaccine"
  | "Deworming"
  | "Ultrasound"
  | "Surgery"
  | "General"
  | "FAMACHA"
  | "FecalEggCount"
  | "BodyConditionScore";
export type BreedingOutcome = "Pending" | "Delivered" | "Stillbirth" | "Miscarriage" | "Doubt";
export type BreedingStatus = "Ready" | "Doubt" | "Delivered" | "Kid";

export type AgreementStatus = "open" | "settled";

export interface Contact {
  id: string;
  name: string;
  type: ContactType;
  phone?: string | null;
  notes?: string | null;
}

export interface Animal {
  id: number;
  name: string | null;
  breed: AnimalBreed | null;
  sex: AnimalSex | null;
  registered_name?: string | null;
  barn_name?: string | null;
  previous_name?: string | null;
  adga_registration_number?: string | null;
  tattoo_right?: string | null;
  tattoo_left?: string | null;
  tattoo_tail_web?: string | null;
  eid_microchip?: string | null;
  scrapie_tag?: string | null;
  farm_tag?: string | null;
  date_of_purchase: string | null;
  age_at_purchase: string | null;
  description: string | null;
  comment: string | null;
  status: AnimalStatus;
  price: number;
  sold_price: number | null;
  purchased_from: string | null;
  owner_id: string | null;
  home_bred: boolean;
  dam_id: number | null;
  sire_id: number | null;
  sire_name: string | null;
  out_date: string | null;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  kind: TransactionKind;
  category: CategoryName;
  animal_id: number | null;
  customer_id: string | null;
  vendor_id: string | null;
  notes: string | null;
  source_row: number | null;
  purchase_agreement_id: string | null;
  livestock_sale_id: string | null;
}

/** Purchase deal — total price vs cash paid so far. */
export interface PurchaseAgreement {
  id: string;
  animal_id: number;
  vendor_id: string | null;
  total_amount: number;
  amount_paid: number;
  status: AgreementStatus;
  notes: string | null;
}

export interface LivestockSale {
  id: string;
  date: string;
  animal_ids: number[];
  gross_sale_price: number;
  delivery_cost: number;
  net_received: number;
  amount_received: number;
  status: AgreementStatus;
  customer_id: string | null;
  notes: string | null;
}

export interface MedicalEvent {
  id: string;
  animal_id: number;
  event_type: MedicalEventType;
  date: string | null;
  notes: string | null;
  /** Optional user note (separate from structured vaccine/deworm notes). */
  comment: string | null;
  transaction_id: string | null;
  product_brand?: string | null;
  active_ingredient?: string | null;
  drug_class?: string | null;
  route?: string | null;
  dose_amount?: number | null;
  dose_unit?: string | null;
  withdrawal_meat_days?: number | null;
  withdrawal_milk_days?: number | null;
  withdrawal_clear_date?: string | null;
  lot_number?: string | null;
  expiration_date?: string | null;
  famacha_score?: number | null;
  body_condition_score?: number | null;
  fecal_egg_count?: number | null;
  fec_reduction_pct?: number | null;
  prior_treatment_event_id?: string | null;
  production_stage?: string | null;
}

export interface BreedingEvent {
  id: string;
  female_animal_id: number;
  male_animal_id: number | null;
  buck_name: string | null;
  date_crossed: string | null;
  exposure_start_date?: string | null;
  exposure_end_date?: string | null;
  expected_due_date: string | null;
  due_date_early?: string | null;
  due_date_late?: string | null;
  delivered_date: string | null;
  ultrasound_date: string | null;
  /** Kids seen on ultrasound: null = unknown, 0 = not pregnant, 1+ = confirmed count. */
  fetus_count: number | null;
  outcome: BreedingOutcome;
  status: BreedingStatus | null;
  notes: string | null;
}

export type MilkSession = "AM" | "PM" | "midday" | "once-daily" | "other";
export type MilkUnit = "lb" | "oz" | "fl-oz";
export type MilkMeasurementMethod = "scale" | "volume" | "estimate";
export type MilkSource = "farm-entered" | "dhia-test" | "lab-result" | "imported";

export interface MilkRecord {
  id: string;
  animal_id: number;
  date: string;
  session: MilkSession;
  amount_raw: number;
  unit_entered: MilkUnit;
  amount_lb_normalized: number;
  measurement_method: MilkMeasurementMethod;
  source: MilkSource;
  operator: string | null;
  notes: string | null;
}

export interface Lactation {
  id: string;
  animal_id: number;
  freshening_date: string;
  lactation_number: number;
  dry_off_date: string | null;
  notes: string | null;
}

export type VetContactRole =
  | "primary"
  | "backup"
  | "emergency clinic"
  | "teaching hospital"
  | "mobile practice"
  | "poison control";

export interface VetContact {
  id: string;
  role: VetContactRole;
  name: string;
  phone: string | null;
  emergency_phone: string | null;
  address: string | null;
  services_offered: string | null;
  accepts_new_clients: string | null;
  vcpr_established: string | null;
  notes: string | null;
}

export interface FarmSettings {
  gestation_days: number;
  gestation_early_days: number;
  gestation_late_days: number;
}

export interface WeightLog {
  id: string;
  animal_id: number;
  weighed_on: string;
  weight_kg: number;
  notes: string | null;
}

export type MediaType = "image" | "video";

export interface AnimalMedia {
  id: string;
  animal_id: number;
  storage_path: string;
  media_type: MediaType;
  caption: string | null;
  created_at: string;
}

export interface FarmDatabase {
  contacts: Contact[];
  animals: Animal[];
  transactions: Transaction[];
  livestock_sales: LivestockSale[];
  purchase_agreements: PurchaseAgreement[];
  medical_events: MedicalEvent[];
  breeding_events: BreedingEvent[];
  weight_logs: WeightLog[];
  animal_media: AnimalMedia[];
  milk_records: MilkRecord[];
  lactations: Lactation[];
  vet_contacts: VetContact[];
  farm_settings: FarmSettings;
  meta: {
    importedAt: string | null;
  };
}
