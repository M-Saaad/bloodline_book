# Bloodline Book — Cursor Planning Document

**Purpose:** Working spec for building Bloodline Book — a standalone product for US/UK/AU ADGA-registered dairy goat breeders (25–100 goats) — from reusable domain logic in the original Al-Yumn Goat Farm codebase.

## §0 — Repo and environment

- **Repo:** `bloodline-book` (this repo) — not a branch of the farm app
- **Supabase:** Brand-new project `bloodline-book-dev` (prod later). **Never** the production farm Supabase.
- **Migrations:** Fresh from `001_initial_schema.sql` — do not carry old `001`–`015` history
- **Seed:** Fake US demo data only — no real farm names or partner UUIDs

Bootstrap source: `alyumn_goat_farm` on GitHub (sibling of `D:\Projects\farm_app` on the author's machine).

## §0.5 — Bootstrap (done)

1. Copy scaffold from old app (exclude `.git`, `node_modules`, `.env.local`, real `data/`)
2. Delete `lib/palai/`, `lib/partner-equity/`, Palai UI, real seed data
3. `001_initial_schema.sql` — single-owner end-state
4. Connect `.env.local` to `bloodline-book-dev`
5. Run migrations before Phase 1

## §1 — Phase 1: Structured health data ✅ (in progress)

**Migration:** `002_structured_medical_events.sql`

Structured columns on `medical_events`: product_brand, active_ingredient, drug_class, route, dose_amount, dose_unit, withdrawal_*, lot_number, expiration_date, famacha_score, body_condition_score, fecal_egg_count, fec_reduction_pct, production_stage.

**Event types:** FAMACHA, FecalEggCount, BodyConditionScore

**Catalogs:**
- Vaccines: disease-target-first (CD&T, CL, Rabies, Pneumonia, Soremouth, Other) with editable product/brand per farm
- Dewormers: US drug classes (benzimidazoles, imidazothiazoles, macrocyclic lactones, tetrahydropyrimidines)
- **No auto-dose calculation** — record actual dose administered only
- **FAMACHA-based reminders** instead of blind 182-day deworm calendar

**UI:** Home dashboard reoriented to "what needs attention today"; FAMACHA health tab

## §2 — Phase 2 (not started)

- Milk / lactation (`milk_records`, `lactations`)
- Breeding exposure windows (`exposure_start_date`, `exposure_end_date`, due date range)
- Vet contacts + single-animal vet-ready summary export

## §3 — Phase 3 (not started)

- US identity fields (ADGA #, tattoos, barn name, etc.)
- Breed list: Nigerian Dwarf, Nubian, LaMancha, Alpine, Saanen, Boer + custom

## §4 — Deferred

See `BACKLOG.md`

## §5 — Demo data

Fabricated US farm before any external demo.

## §6 — Documentation

- `docs/DATA-MODEL.md`, `docs/BUSINESS-RULES.md`, `docs/ICP.md` — keep updated with code

## §7 — UI/UX direction

- Offline-first: tracked separately (meaningful engineering lift)
- Group health actions under Health nav; extend quick-entry
- Large touch targets, color + icon for status
- Home: actionable reminders, not equity/finance-first

## Build order

1. Separate repo + Supabase ✅
2. Structured health + US catalogs ✅ (schema + core logic)
3. Milk, breeding windows, vet summary
4. Identity model
5. Dashboard + quick-entry extensions (partial ✅)
6. Docs ongoing ✅
7. `BACKLOG.md` for §4
