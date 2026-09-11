# Data Model — Bloodline Book

All types are defined in `lib/types.ts`. Postgres schema mirrors these in `supabase/migrations/` (fresh `001`+ history for `bloodline-book-dev`).

> **Note:** Sections below that reference partner equity, Palai, or PKR belong to the original Al-Yumn farm app and are **not** part of Bloodline Book. See `docs/BLOODLINE-BOOK.md` for the current product scope.

## Entity relationship summary (Bloodline Book)

```
contacts ──┬── animals (purchased_from, owner_id)
           └── transactions (vendor_id, customer_id)

animals ───┬── transactions (animal_id)
           ├── medical_events (structured health — see below)
           ├── breeding_events
           ├── weight_logs
           ├── animal_media
           ├── purchase_agreements
           └── livestock_sales (animal_ids[])

transactions ──┬── medical_events (optional transaction_id)
               ├── purchase_agreements
               └── livestock_sales
```

## MedicalEvent (Phase 1 — structured health)

```typescript
interface MedicalEvent {
  id: string;
  animal_id: number;
  event_type:
    | "Vaccine" | "Deworming" | "Ultrasound" | "Surgery" | "General"
    | "FAMACHA" | "FecalEggCount" | "BodyConditionScore";
  date: string | null;
  notes: string | null;       // legacy shorthand + vaccine/deworm display string
  comment: string | null;     // free-text user note
  transaction_id: string | null;
  // Structured treatment fields (Vaccine / Deworming / Surgery)
  product_brand?: string | null;
  active_ingredient?: string | null;
  drug_class?: string | null;
  route?: string | null;      // oral drench, injectable, topical, feed, intranasal
  dose_amount?: number | null;
  dose_unit?: string | null;  // mL, cc, mg, per-kg, per-lb
  withdrawal_meat_days?: number | null;
  withdrawal_milk_days?: number | null;
  withdrawal_clear_date?: string | null;  // computed on save
  lot_number?: string | null;
  expiration_date?: string | null;
  // Clinical scoring
  famacha_score?: number | null;          // 1–5
  body_condition_score?: number | null;   // 1–5 in 0.5 steps
  fecal_egg_count?: number | null;        // EPG
  fec_reduction_pct?: number | null;
  prior_treatment_event_id?: string | null;
  production_stage?: string | null;       // dry, peak lactation, etc.
}
```

Vaccine schedules are **disease-target-first** (`lib/livestock/vaccine-schedule.ts`). Dewormer catalogs are **drug-class-first** (`lib/livestock/medical-notes.ts`). Custom products remain extensible via event history (same pattern as the original custom vaccine/dewormer support).

## Animal identity (Phase 3)

`animals.breed` is **free text** with UI suggestions (`SUGGESTED_BREEDS` in `lib/types.ts`). Identity fields:

- `registered_name`, `barn_name`, `previous_name`
- `adga_registration_number`
- `tattoo_right`, `tattoo_left`, `tattoo_tail_web` (LaMancha)
- `eid_microchip`, `scrapie_tag`, `farm_tag`

## BreedingEvent (Phase 2 — exposure windows)

```typescript
exposure_start_date: string | null;
exposure_end_date: string | null;
expected_due_date: string | null;   // mid-point of gestation
due_date_early: string | null;      // gestation − early offset (default 5d)
due_date_late: string | null;       // gestation + late offset (default 5d)
```

Gestation defaults live in `farm_settings` (`gestation_days` default 150).

## MilkRecord & Lactation (Phase 2)

`milk_records`: per-session yields (`AM` / `PM` / …), `amount_lb_normalized` for totals, `source` for DHIA/lab later.

`lactations`: `freshening_date`, `lactation_number`, `dry_off_date`. Derived stats in `lib/livestock/milk.ts`.

## VetContact (Phase 2)

Farm-level `vet_contacts` with `role` (primary, backup, emergency clinic, …). Vet-ready per-animal export: `/animals/[id]/vet-summary` via `lib/livestock/vet-summary.ts`.

---

## Legacy entity diagram (original farm app — deprecated here)

## Core entities

### Contact

People and entities referenced across the app.

```typescript
interface Contact {
  id: string;           // UUID
  name: string;         // Unique display name
  type: "Vendor" | "Customer" | "Partner" | "Farm";
  phone?: string | null;
  notes?: string | null;
}
```

**Fixed partners (must exist):**

| Name | Type | Sample UUID |
|------|------|-------------|
| Monis | Partner | `f2881370-db8d-4cab-9c18-a035ae97b860` |
| Saad | Partner | `32891181-c675-41cd-818e-a96e96517ae5` |
| Farm | Farm | `fab8763e-65b6-49c1-8b44-59de0c258d23` |

Sample customers: Awais, Arsalan. Sample vendors: Lal goat farm, Waheed goat farm, Danish (Boss).

### Animal

```typescript
interface Animal {
  id: number;                    // Integer PK (not auto-increment in import)
  name: string | null;
  breed: "Gulabi" | "Teddy" | "Bissar" | "Tapra" | null;
  sex: "Male" | "Female" | null;
  date_of_purchase: string | null;  // YYYY-MM-DD
  age_at_purchase: string | null;   // Free text, e.g. "6 months"
  description: string | null;
  comment: string | null;
  status: "Active" | "Died" | "Sold" | "Slaughtered" | "Gone";
  price: number;                 // Purchase/cost basis
  sold_price: number | null;
  purchased_from: string | null; // Contact UUID (vendor)
  owner_id: string | null;     // Contact UUID (Farm, Partner, or Customer for Palai)
  home_bred: boolean;
  dam_id: number | null;
  sire_id: number | null;
  sire_name: string | null;    // External buck name when sire not in herd
  out_date: string | null;     // Date left herd (sale/death/etc.)
  palai_rate: number | null;   // Monthly PKR per goat for Palai customers
}
```

**Current herd breakdown (committed data):**

| Status | Count |
|--------|-------|
| Active | 23 |
| Died | 11 |
| Sold | 7 |
| Slaughtered | 4 |
| Gone | 2 |

### Transaction

The ledger backbone. Two kinds:

```typescript
type TransactionKind = "cost" | "partner_adjustment";

interface Transaction {
  id: string;
  date: string;                  // YYYY-MM-DD
  amount: number;                // Always positive for costs; signed for adjustments
  kind: TransactionKind;
  category: CategoryName;        // Built-in or custom string
  farm_model: "Trading" | "Palai" | null;
  animal_id: number | null;
  customer_id: string | null;
  vendor_id: string | null;
  paid_by_partner_id: string | null;      // cost rows only
  received_by_partner_id: string | null;  // income/sale receipt rows
  adjustment_partner_id: string | null;   // Monis id on adjustment rows
  notes: string | null;
  source_row: number | null;     // Original Google Sheets row (import traceability)
  purchase_agreement_id: string | null;
  livestock_sale_id: string | null;
}
```

**Built-in categories** (`LEDGER_CATEGORIES` in `lib/types.ts`):

Feed, Delivery, Vet/Medicine, Labor, Infrastructure, Livestock Purchase, Livestock Sale, Palai Income, Palai Expense, Partner Transfer, Other

Custom categories are stored as plain text (migration 012).

**Transaction counts by category (committed data):**

| Category | Rows |
|----------|------|
| Feed | 149 |
| Delivery | 56 |
| Infrastructure | 54 |
| Vet/Medicine | 47 |
| Partner Transfer | 46 |
| Labor | 38 |
| Livestock Purchase | 33 |
| Palai Income | 22 |
| Palai Expense | 8 |
| Livestock Sale | 4 |

### PartnerLedgerEntry

Denormalized audit trail — one row per partner side of a transaction.

```typescript
interface PartnerLedgerEntry {
  id: string;
  transaction_id: string;
  partner_id: string;
  amount: number;
  category: CategoryName;
  created_at: string;
}
```

### PalaiPayment

```typescript
interface PalaiPayment {
  id: string;
  date: string;              // Receipt date
  service_month: string;     // YYYY-MM — fee period
  customer_id: string;
  rate_per_goat: number | null;
  goat_count: number | null;
  total_amount: number;
  payment_method: string | null;
  transaction_id: string | null;  // Links to partner_adjustment row
  notes: string | null;
}
```

19 payments in committed data. Multiple payments for the same customer+month may merge per `lib/palai/service-month.ts`.

### LivestockSale

Tracks sale metadata; each cash receipt creates a separate `partner_adjustment` transaction for one partner's half.

```typescript
interface LivestockSale {
  id: string;
  date: string;
  animal_ids: number[];
  gross_sale_price: number;
  delivery_cost: number;
  net_received: number;           // gross - delivery
  partner_share: number;          // net / 2
  received_by_partner_id: string;
  transaction_id: string | null;  // Initial receipt tx
  amount_received: number;        // Running total received
  status: "open" | "settled";     // settled when fully paid
  notes: string | null;
}
```

### PurchaseAgreement

Installment purchase tracking.

```typescript
interface PurchaseAgreement {
  id: string;
  animal_id: number;
  vendor_id: string | null;
  total_amount: number;
  amount_paid: number;
  status: "open" | "settled";
  notes: string | null;
}
```

### MedicalEvent

```typescript
interface MedicalEvent {
  id: string;
  animal_id: number;
  event_type: "Vaccine" | "Deworming" | "Ultrasound" | "Surgery" | "General";
  date: string | null;
  notes: string | null;       // Structured (vaccine name, deworm type, etc.)
  comment: string | null;     // Free-text user note
  transaction_id: string | null;  // Linked Vet/Medicine cost if any
}
```

Vaccine names and dewormer names are stored in `notes` (not separate lookup tables after migration 013).

### BreedingEvent

```typescript
interface BreedingEvent {
  id: string;
  female_animal_id: number;
  male_animal_id: number | null;
  buck_name: string | null;
  date_crossed: string | null;
  expected_due_date: string | null;  // Auto: crossed + ~150 days
  delivered_date: string | null;
  ultrasound_date: string | null;
  fetus_count: number | null;   // null=unknown, 0=not pregnant, 1+=confirmed
  outcome: "Pending" | "Delivered" | "Stillbirth" | "Miscarriage" | "Doubt";
  status: "Ready" | "Doubt" | "Delivered" | "Kid" | null;
  notes: string | null;
}
```

### WeightLog / AnimalMedia

Standard audit fields. Media uses Supabase Storage path in `storage_path`.

## FarmDatabase envelope

JSON file and in-memory shape:

```typescript
interface FarmDatabase {
  contacts: Contact[];
  animals: Animal[];
  transactions: Transaction[];
  partner_ledger_entries: PartnerLedgerEntry[];
  palai_payments: PalaiPayment[];
  livestock_sales: LivestockSale[];
  purchase_agreements: PurchaseAgreement[];
  medical_events: MedicalEvent[];
  breeding_events: BreedingEvent[];
  weight_logs: WeightLog[];
  animal_media: AnimalMedia[];
  meta: {
    importedAt: string | null;
    settlementVerified: boolean;
    monisDiff: number | null;
    saadDiff: number | null;
  };
}
```

**Committed meta:**

```json
{
  "importedAt": "2026-08-10T07:29:28.060Z",
  "settlementVerified": true,
  "monisDiff": 192247,
  "saadDiff": -192247
}
```

## Postgres extras (Supabase only)

| Table | Purpose |
|-------|---------|
| `profiles` | Maps auth user → `partner` or `guest` role (migration 015) |

Storage bucket `animal-media` for photos/videos (migration 002).

## Sample transaction patterns

### Cost expense (Monis paid feed)

```json
{
  "kind": "cost",
  "amount": 5000,
  "category": "Feed",
  "paid_by_partner_id": "<monis-uuid>",
  "received_by_partner_id": null
}
```

Effect: `monisFunded += 5000`, `costBase += 5000`.

### Palai income (Saad received customer payment)

```json
{
  "kind": "partner_adjustment",
  "amount": 7500,
  "category": "Palai Income",
  "adjustment_partner_id": "<monis-uuid>",
  "received_by_partner_id": "<saad-uuid>"
}
```

Where `7500 = total_amount / 2`. Effect: `monisFunded += 7500`, `saadFunded -= 7500`.

### Livestock sale receipt (Monis received cash)

```json
{
  "kind": "partner_adjustment",
  "amount": -25000,
  "category": "Livestock Sale",
  "received_by_partner_id": "<monis-uuid>"
}
```

Negative adjustment credits Saad's share when Monis holds the cash.
