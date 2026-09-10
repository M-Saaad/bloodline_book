# Business Rules — Bloodline Book

## Vet content guardrail (non-negotiable)

Bloodline Book **records** what was done. It does **not**:

- Recommend doses or auto-calculate suggested doses
- Diagnose illness or triage symptoms
- Establish or claim a VCPR through the app
- Provide teleconsult or treatment suggestions

If future AI features are added, they may only help compose a vet-ready summary or say **"call your vet."**

## Health reminders

**File:** `lib/livestock/herd-health.ts`

### Vaccines

- Built-in disease targets: CD&T, CL, Rabies, Pneumonia/respiratory, Soremouth, Other
- Each target has a farm-editable product/brand underneath
- Due dates computed from last vaccine of that target + interval (default yearly)
- Custom vaccines discovered from history keep their logged interval

### Deworming — FAMACHA-first (not blind calendar)

- **Do not** use a fixed 182-day internal deworm interval
- Reminder text: **"Check FAMACHA"** when `FAMACHA_CHECK_INTERVAL_DAYS` (28) has elapsed since last FAMACHA score
- Internal deworming is a clinical decision after FAMACHA/FEC — not auto-scheduled
- External deworm follow-up: 2 days after latest internal deworm if no external deworm since

### Withdrawal periods

- `withdrawal_clear_date` = event date + max(meat_days, milk_days)
- Animals with `withdrawal_clear_date >= today` appear in home/health "needs attention"

### Dosing

Store **actual dose administered** (amount + unit) as entered. Never infer dose from weight or product label.

## Transactions (single-owner)

**File:** `lib/transactions/ledger.ts`

| Kind | Meaning |
|------|---------|
| `cost` | Money spent (positive amount) |
| `income` | Money received (positive amount) |

Categories: Feed, Delivery, Vet/Medicine, Labor, Infrastructure, Livestock Purchase, Livestock Sale, Other (+ custom strings on `transactions.category`).

No partner ledger, no 50/50 splits.

## Livestock sales

**File:** `lib/livestock/record-sale.ts`

```
net_received = gross_sale_price - delivery_cost
```

- `amount_received` tracks partial payments; `status` open until fully paid
- Income transactions link via `livestock_sale_id`
- Animals marked `Sold` with `out_date` (no "sold on palai" path)

## Breeding

- Gestation default 150 days (`lib/livestock/breeding.ts`)
- Ultrasound window: days 40–75 after breeding
- Expected due date from `date_crossed` (exposure windows in Phase 2)

---

## Legacy rules (original Al-Yumn farm app)

The sections below in git history described partner equity, Palai boarding, and PKR settlement. They are **not implemented** in Bloodline Book. See `alyumn_goat_farm` if needed for reference.
