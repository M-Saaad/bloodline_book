"use client";

import { useState } from "react";
import {
  actionAcquireFromCustomer,
  actionBuyGoat,
  actionChangeStatus,
  actionLogExpense,
  actionLogMedical,
  actionLogMilk,
  actionLogWeight,
  actionRecordBreeding,
  actionRecordLivestockSale,
  actionRegisterBornGoat,
} from "@/lib/server-actions";
import { NEW_EXPENSE_CATEGORY_VALUE } from "@/lib/transactions/expense-categories";
import {
  DEWORM_TYPES,
  DOSE_UNITS,
  MEDICAL_ROUTES,
  PRODUCTION_STAGES,
  type DewormType,
} from "@/lib/livestock/medical-notes";
import {
  NEW_VACCINE_VALUE,
  VACCINE_INTERVAL_PRESETS,
  isBuiltinVaccineKey,
  type VaccineScheduleEntry,
} from "@/lib/livestock/vaccine-schedule";
import { todayIso } from "@/lib/format";
import { NON_NEGATIVE_NUMBER_INPUT_PROPS } from "@/lib/form-numbers";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { BuckSelect, ContactSelect, type ContactOption } from "@/components/ContactSelect";
type AnimalOption = { id: number; label: string };
type CustomerOwnedAnimalOption = { id: number; label: string; ownerName: string };
type Mode =
  | null
  | "expense"
  | "buy"
  | "acquire"
  | "born"
  | "medical"
  | "milk"
  | "weight"
  | "breeding"
  | "sell"
  | "status";

const field =
  "mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 outline-none focus:border-emerald-600";
const label = "block text-sm font-medium text-stone-700";

export type QuickEntryProps = {
  animals: AnimalOption[];
  customerOwnedAnimals?: CustomerOwnedAnimalOption[];
  femaleAnimals?: AnimalOption[];
  damAnimals?: AnimalOption[];
  vendors: ContactOption[];
  customers: ContactOption[];
  ownerOptions: ContactOption[];
  maleAnimals: AnimalOption[];
  pastBuckNames: string[];
  vaccineSchedules: VaccineScheduleEntry[];
  dewormerNamesByType: Record<DewormType, string[]>;
  expenseCategories: string[];
};

export function QuickEntry({
  animals,
  customerOwnedAnimals = [],
  femaleAnimals,
  damAnimals,
  vendors,
  customers,
  ownerOptions,
  maleAnimals,
  pastBuckNames,
  vaccineSchedules,
  dewormerNamesByType,
  expenseCategories,
}: QuickEntryProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const females = femaleAnimals ?? animals;

  function pick(m: Mode) {
    setMode(m);
  }

  function close() {
    setOpen(false);
    setMode(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-3xl font-light text-white shadow-lg touch-manipulation"
        aria-label="Quick entry"
      >
        +
      </button>

      {open && (
        <div className="fixed inset-0 z-[55] flex items-end bg-black/40 sm:items-center sm:justify-center">
          <div className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-2xl bg-stone-50 sm:rounded-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-stone-200 p-4">
              <h2 className="text-lg font-bold text-stone-900">
                {mode ? modeLabel(mode) : "Quick Entry"}
              </h2>
              <button type="button" onClick={close} className="rounded-lg px-3 py-1 text-stone-600">
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            {!mode && (
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["expense", "Log Expense"],
                    ["buy", "Buy Goat"],
                    ["acquire", "Buy from Customer"],
                    ["born", "Record Birth"],
                    ["medical", "Log Health"],
                    ["milk", "Log Milk"],
                    ["weight", "Log Weight"],
                    ["breeding", "Record Breeding"],
                    ["sell", "Sell Goat"],
                    ["status", "Change Status"],
                  ] as const
                ).map(([k, text]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => pick(k)}
                    className="rounded-xl bg-white p-4 text-left text-sm font-semibold text-stone-800 shadow-sm ring-1 ring-stone-200"
                  >
                    {text}
                  </button>
                ))}
              </div>
            )}

            {mode === "expense" && (
              <ExpenseForm
                expenseCategories={expenseCategories}
                animals={animals}
                onSuccess={close}
              />
            )}

            {mode === "buy" && (
              <BuyGoatForm vendors={vendors} ownerOptions={ownerOptions} onSuccess={close} />
            )}

            {mode === "acquire" && (
              <AcquireFromCustomerForm
                animals={customerOwnedAnimals}
                onSuccess={close}
              />
            )}

            {mode === "born" && (
              <BornGoatForm
                damAnimals={damAnimals ?? females}
                maleAnimals={maleAnimals}
                pastBuckNames={pastBuckNames}
                ownerOptions={ownerOptions}
                onSuccess={close}
              />
            )}

            {mode === "medical" && (
              <MedicalForm
                animals={animals}
                vaccineSchedules={vaccineSchedules}
                dewormerNamesByType={dewormerNamesByType}
                onSuccess={close}
              />
            )}

            {mode === "milk" && (
              <MilkForm animals={females} onSuccess={close} />
            )}

            {mode === "weight" && (
              <ActionForm action={actionLogWeight} onSuccess={close}>
                <AnimalSelect animals={animals} />
                <Field label="Date" name="date" type="date" defaultValue={todayIso()} required />
                <Field label="Weight (kg)" name="weightKg" type="number" required />
                <Field label="Notes" name="notes" />
                <SubmitButton label="Save weight" />
              </ActionForm>
            )}

            {mode === "breeding" && (
              females.length === 0 ? (
                <p className="text-sm text-stone-600">No active female goats to record breeding for.</p>
              ) : (
                <ActionForm action={actionRecordBreeding} onSuccess={close}>
                  <div>
                    <label className={label}>Female</label>
                    <select name="femaleId" className={field} required>
                      {females.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <BuckSelect maleAnimals={maleAnimals} pastNames={pastBuckNames} />
                  <Field label="Exposure start" name="exposureStart" type="date" defaultValue={todayIso()} required />
                  <Field label="Exposure end" name="exposureEnd" type="date" defaultValue={todayIso()} required />
                  <Field label="Notes" name="notes" />
                  <p className="text-xs text-stone-500">
                    For a single known breeding date, use the same start and end. Due window uses farm gestation settings (default 150 ± 5 days).
                  </p>
                  <SubmitButton />
                </ActionForm>
              )
            )}

            {mode === "sell" && (
              <SellGoatForm
                animals={animals}
                customers={customers}
                vendors={vendors}
                onSuccess={close}
              />
            )}

            {mode === "status" && (
              <ActionForm action={actionChangeStatus} onSuccess={close}>
                <AnimalSelect animals={animals} />
                <div>
                  <label className={label}>Status</label>
                  <select name="status" className={field} required>
                    {["Active", "Died", "Sold", "Slaughtered", "Gone"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <Field label="Out date" name="outDate" type="date" defaultValue={todayIso()} />
                <p className="text-xs text-stone-500">
                  For sales with installments, use &quot;Sell Goat&quot; instead.
                </p>
                <SubmitButton />
              </ActionForm>
            )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ExpenseForm({
  expenseCategories,
  animals,
  onSuccess,
}: {
  expenseCategories: string[];
  animals: AnimalOption[];
  onSuccess: () => void;
}) {
  const [category, setCategory] = useState(expenseCategories[0] ?? "Other");

  return (
    <ActionForm action={actionLogExpense} onSuccess={onSuccess}>
      <Field label="Date" name="date" type="date" defaultValue={todayIso()} required />
      <Field label="Amount (USD)" name="amount" type="number" required />
      <div>
        <label className={label}>Category</label>
        <select
          name="category"
          className={field}
          required
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {expenseCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
          <option value={NEW_EXPENSE_CATEGORY_VALUE}>+ Add new category…</option>
        </select>
      </div>
      {category === NEW_EXPENSE_CATEGORY_VALUE && (
        <Field label="New category name" name="categoryOther" required />
      )}
      <AnimalSelect animals={animals} optional />
      <Field label="Notes" name="notes" />
      <SubmitButton />
    </ActionForm>
  );
}

function MedicalForm({
  animals,
  vaccineSchedules,
  dewormerNamesByType,
  onSuccess,
}: {
  animals: AnimalOption[];
  vaccineSchedules: VaccineScheduleEntry[];
  dewormerNamesByType: Record<DewormType, string[]>;
  onSuccess: () => void;
}) {
  const [eventType, setEventType] = useState("Vaccine");
  const [vaccineName, setVaccineName] = useState<string>(vaccineSchedules[0]?.name ?? NEW_VACCINE_VALUE);
  const [dewormType, setDewormType] = useState<DewormType>("internal");
  const [dewormerName, setDewormerName] = useState<string>(
    dewormerNamesByType.internal[0] ?? "Other"
  );

  const dewormerOptions = dewormerNamesByType[dewormType];
  const selectedVaccine = vaccineSchedules.find((v) => v.name === vaccineName);
  const extraVaccineIntervalDays =
    selectedVaccine && !isBuiltinVaccineKey(selectedVaccine.key)
      ? selectedVaccine.intervalDays
      : null;

  function onDewormTypeChange(next: DewormType) {
    setDewormType(next);
    const options = dewormerNamesByType[next];
    setDewormerName((prev) => (prev === "Other" || options.includes(prev) ? prev : options[0] ?? "Other"));
  }

  return (
    <ActionForm action={actionLogMedical} onSuccess={onSuccess}>
      <AnimalMultiSelect animals={animals} />
      <div>
        <label className={label}>Event type</label>
        <select
          name="eventType"
          className={field}
          required
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
        >
          {[
            "Vaccine",
            "Deworming",
            "FAMACHA",
            "FecalEggCount",
            "BodyConditionScore",
            "Ultrasound",
            "Surgery",
            "General",
          ].map((e) => (
            <option key={e} value={e}>
              {e === "FecalEggCount" ? "Fecal egg count" : e === "BodyConditionScore" ? "Body condition" : e}
            </option>
          ))}
        </select>
      </div>
      <Field label="Date" name="date" type="date" defaultValue={todayIso()} required />

      {eventType === "Vaccine" && (
        <>
          <div>
            <label className={label}>Vaccine</label>
            <select
              name="vaccineName"
              className={field}
              required
              value={vaccineName}
              onChange={(e) => setVaccineName(e.target.value)}
            >
              {vaccineSchedules.map((v) => (
                <option key={v.key} value={v.name}>
                  {v.name}
                </option>
              ))}
              <option value={NEW_VACCINE_VALUE}>+ Add new vaccine type…</option>
            </select>
          </div>
          {vaccineName === NEW_VACCINE_VALUE && (
            <>
              <Field label="Vaccine name" name="vaccineNameOther" required />
              <div>
                <label className={label}>Schedule</label>
                <select
                  name="vaccineIntervalDays"
                  className={field}
                  required
                  defaultValue={String(VACCINE_INTERVAL_PRESETS[0].value)}
                >
                  {VACCINE_INTERVAL_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          {vaccineName !== NEW_VACCINE_VALUE && extraVaccineIntervalDays != null && (
            <input type="hidden" name="vaccineIntervalDays" value={String(extraVaccineIntervalDays)} />
          )}
          <Field label="Product / brand" name="productBrand" placeholder="Bar-Vac CD/T" />
          <Field label="Dosage" name="dosage" defaultValue="1 ml" required />
          <StructuredDrugFields />
          <Field label="Note (optional)" name="comment" />
        </>
      )}

      {eventType === "Deworming" && (
        <>
          <div>
            <label className={label}>Type</label>
            <select
              name="dewormType"
              className={field}
              required
              value={dewormType}
              onChange={(e) => onDewormTypeChange(e.target.value as DewormType)}
            >
              {DEWORM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Dewormer</label>
            <select
              name="dewormerName"
              className={field}
              required
              value={dewormerName}
              onChange={(e) => setDewormerName(e.target.value)}
            >
              {dewormerOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value="Other">Other</option>
            </select>
          </div>
          {dewormerName === "Other" && (
            <Field label="Dewormer name" name="dewormerNameOther" required />
          )}
          <Field label="Product / brand" name="productBrand" />
          <Field label="Dosage" name="dosage" defaultValue="1 ml" required />
          <StructuredDrugFields />
          <Field label="Note (optional)" name="comment" />
        </>
      )}

      {eventType === "FAMACHA" && (
        <>
          <Field label="FAMACHA score (1–5)" name="famachaScore" type="number" min={1} max={5} required />
          <Field label="Body condition (optional)" name="bodyConditionScore" type="number" min={1} max={5} step={0.5} />
          <ProductionStageSelect />
          <Field label="Note (optional)" name="comment" />
        </>
      )}

      {eventType === "FecalEggCount" && (
        <>
          <Field label="Fecal egg count (EPG)" name="fecalEggCount" type="number" min={0} required />
          <Field label="FEC reduction % (follow-up)" name="fecReductionPct" type="number" min={0} max={100} />
          <Field label="Note (optional)" name="comment" />
        </>
      )}

      {eventType === "BodyConditionScore" && (
        <>
          <Field label="Body condition (1–5, 0.5 steps)" name="bodyConditionScore" type="number" min={1} max={5} step={0.5} required />
          <ProductionStageSelect />
          <Field label="Note (optional)" name="comment" />
        </>
      )}

      {eventType !== "Vaccine" &&
        eventType !== "Deworming" &&
        eventType !== "FAMACHA" &&
        eventType !== "FecalEggCount" &&
        eventType !== "BodyConditionScore" && (
        <Field label="Notes" name="notes" />
      )}

      <SubmitButton />
    </ActionForm>
  );
}

function StructuredDrugFields() {
  return (
    <>
      <Field label="Active ingredient (optional)" name="activeIngredient" />
      <div>
        <label className={label}>Route</label>
        <select name="route" className={field} defaultValue="">
          <option value="">—</option>
          {MEDICAL_ROUTES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Dose amount" name="doseAmount" type="number" min={0} step="any" />
        <div>
          <label className={label}>Dose unit</label>
          <select name="doseUnit" className={field} defaultValue="">
            <option value="">—</option>
            {DOSE_UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Meat withdrawal (days)" name="withdrawalMeatDays" type="number" min={0} />
        <Field label="Milk withdrawal (days)" name="withdrawalMilkDays" type="number" min={0} />
      </div>
      <Field label="Lot number" name="lotNumber" />
      <Field label="Expiration date" name="expirationDate" type="date" />
    </>
  );
}

function ProductionStageSelect() {
  return (
    <div>
      <label className={label}>Production stage</label>
      <select name="productionStage" className={field} defaultValue="">
        <option value="">—</option>
        {PRODUCTION_STAGES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>
  );
}

function MilkForm({
  animals,
  onSuccess,
}: {
  animals: AnimalOption[];
  onSuccess: () => void;
}) {
  return (
    <ActionForm action={actionLogMilk} onSuccess={onSuccess}>
      <AnimalSelect animals={animals} fieldLabel="Doe" />
      <Field label="Date" name="date" type="date" defaultValue={todayIso()} required />
      <div>
        <label className={label}>Session</label>
        <select name="session" className={field} defaultValue="AM">
          {["AM", "PM", "midday", "once-daily", "other"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Amount" name="amount" type="number" min={0} step="any" required />
        <div>
          <label className={label}>Unit</label>
          <select name="unit" className={field} defaultValue="lb">
            {["lb", "oz", "fl-oz"].map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>
      <Field label="Operator (optional)" name="operator" />
      <Field label="Notes" name="notes" />
      <SubmitButton />
    </ActionForm>
  );
}

function SellGoatForm({
  animals,
  customers,
  vendors,
  onSuccess,
}: {
  animals: AnimalOption[];
  customers: ContactOption[];
  vendors: ContactOption[];
  onSuccess: () => void;
}) {
  const buyerOptions = [...vendors, ...customers].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <ActionForm action={actionRecordLivestockSale} onSuccess={onSuccess}>
      <AnimalSelect animals={animals} />
      <AnimalSelect
        animals={animals}
        optional
        name="additionalAnimalId"
        fieldLabel="Second goat (optional)"
      />
      <Field label="Sale date" name="date" type="date" defaultValue={todayIso()} required />
      <Field label="Gross sale price (USD)" name="grossSalePrice" type="number" required />
      <Field
        label="Received now (USD, optional)"
        name="amountReceivedNow"
        type="number"
        min={0}
      />
      <p className="text-xs text-stone-500">
        Leave blank for full net proceeds now. Enter 0 to record the sale now and collect payment
        later from the goat profile.
      </p>
      <Field
        label="Delivery deducted from proceeds"
        name="deliveryCost"
        type="number"
        defaultValue="0"
      />
      <ContactSelect
        label="Buyer (optional)"
        name="buyerName"
        options={buyerOptions}
        allowEmpty
        emptyLabel="—"
        addNewLabel="+ Add buyer"
      />
      <Field label="Notes" name="notes" />
      <p className="text-xs text-stone-500">
        Goat is marked sold immediately. Add further receipts from the goat profile if needed.
      </p>
      <SubmitButton />
    </ActionForm>
  );
}

function AcquireFromCustomerForm({
  animals,
  onSuccess,
}: {
  animals: CustomerOwnedAnimalOption[];
  onSuccess: () => void;
}) {
  const [selectedId, setSelectedId] = useState(
    animals.length === 1 ? String(animals[0].id) : ""
  );
  const selected = animals.find((a) => String(a.id) === selectedId);

  if (animals.length === 0) {
    return (
      <p className="text-sm text-stone-600">
        No customer-owned goats available. Only customer-owned goats can be bought by the farm.
      </p>
    );
  }

  return (
    <ActionForm action={actionAcquireFromCustomer} onSuccess={onSuccess}>
      <div>
        <label className={label}>Goat (customer-owned)</label>
        <select
          name="animalId"
          className={field}
          required
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="" disabled>Select goat</option>
          {animals.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
      {selected && (
        <p className="text-xs text-stone-500">
          Seller: <span className="font-medium text-stone-700">{selected.ownerName}</span> — ownership
          transfers to Farm.
        </p>
      )}
      <Field label="Purchase date" name="date" type="date" defaultValue={todayIso()} required />
      <Field label="Purchase price (USD)" name="price" type="number" required />
      <Field
        label="Paid now (optional)"
        name="paidNow"
        type="number"
        min={0}
      />
      <Field label="Notes (optional)" name="notes" />
      <p className="text-xs text-stone-500">
        Leave blank to record full payment now. Enter 0 to defer payment — add installments later on
        the goat profile.
      </p>
      <SubmitButton label="Buy from customer" pendingLabel="Saving…" />
    </ActionForm>
  );
}

function BuyGoatForm({
  vendors,
  ownerOptions,
  onSuccess,
}: {
  vendors: ContactOption[];
  ownerOptions: ContactOption[];
  onSuccess: () => void;
}) {
  return (
    <ActionForm action={actionBuyGoat} onSuccess={onSuccess}>
      <Field label="Date" name="date" type="date" defaultValue={todayIso()} required />
      <Field label="Name (optional)" name="name" />
      <Field label="Description" name="description" required />
      <div>
        <label className={label}>Breed</label>
        <select name="breed" className={field} required>
          {["Nigerian Dwarf", "Nubian", "LaMancha", "Alpine", "Saanen", "Boer"].map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={label}>Sex</label>
        <select name="sex" className={field} required>
          <option>Female</option>
          <option>Male</option>
        </select>
      </div>
      <ContactSelect
        label="Owner"
        name="ownerName"
        options={ownerOptions}
        defaultValue="Farm"
        required
        addNewLabel="+ Add new customer"
      />
      <ContactSelect
        label="Vendor"
        name="vendorName"
        options={vendors}
        allowEmpty
        emptyLabel="—"
        addNewLabel="+ Add new vendor"
      />
      <Field label="Total price" name="price" type="number" required />
      <Field
        label="Paid now (optional)"
        name="paidNow"
        type="number"
        min={0}
      />
      <SubmitButton label="Add goat" pendingLabel="Adding…" />
      <p className="text-xs text-stone-500">
        Leave blank to record full payment now. Enter 0 if the balance will be paid in future
        installments (add payments from the goat profile).
      </p>
    </ActionForm>
  );
}

function BornGoatForm({
  damAnimals,
  maleAnimals,
  pastBuckNames,
  ownerOptions,
  onSuccess,
}: {
  damAnimals: AnimalOption[];
  maleAnimals: AnimalOption[];
  pastBuckNames: string[];
  ownerOptions: ContactOption[];
  onSuccess: () => void;
}) {
  return (
    <ActionForm action={actionRegisterBornGoat} onSuccess={onSuccess}>
      <Field label="Birth date" name="date" type="date" defaultValue={todayIso()} required />
      <div>
        <label className={label}>Dam (mother)</label>
        <select name="damId" className={field} required>
          <option value="">Select dam…</option>
          {damAnimals.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
      <BuckSelect
        label="Sire (optional)"
        optional
        maleAnimals={maleAnimals}
        pastNames={pastBuckNames}
        nameField="sireName"
        idField="sireAnimalId"
      />
      <Field label="Name (optional)" name="name" />
      <Field label="Description" name="description" required />
      <div>
        <label className={label}>Breed</label>
        <select name="breed" className={field} required>
          {["Nigerian Dwarf", "Nubian", "LaMancha", "Alpine", "Saanen", "Boer"].map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={label}>Sex</label>
        <select name="sex" className={field} required>
          <option>Female</option>
          <option>Male</option>
        </select>
      </div>
      <ContactSelect
        label="Owner"
        name="ownerName"
        options={ownerOptions}
        defaultValue="Farm"
        required
        addNewLabel="+ Add new customer"
      />
      <Field label="Notes (optional)" name="comment" />
      <p className="text-xs text-stone-500">
        Farm-born kids have no purchase price or vendor. Costs (feed, vet) can still be logged
        against this goat later.
      </p>
      <SubmitButton label="Add kid" pendingLabel="Adding…" />
    </ActionForm>
  );
}

function modeLabel(m: Mode) {
  switch (m) {
    case "expense":
      return "Log Expense";
    case "buy":
      return "Buy Goat";
    case "acquire":
      return "Buy from Customer";
    case "born":
      return "Record Birth";
    case "medical":
      return "Log Health";
    case "milk":
      return "Log Milk";
    case "weight":
      return "Log Weight";
    case "breeding":
      return "Record Breeding";
    case "sell":
      return "Sell Goat";
    case "status":
      return "Change Status";
    default:
      return "Quick Entry";
  }
}

function Field(props: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number | string;
}) {
  const isNumber = props.type === "number";
  return (
    <div>
      <label className={label}>{props.label}</label>
      <input
        className={field}
        name={props.name}
        type={props.type || "text"}
        defaultValue={props.defaultValue}
        placeholder={props.placeholder}
        required={props.required}
        min={isNumber ? (props.min ?? NON_NEGATIVE_NUMBER_INPUT_PROPS.min) : undefined}
        max={isNumber ? props.max : undefined}
        step={
          isNumber ? (props.step ?? NON_NEGATIVE_NUMBER_INPUT_PROPS.step) : undefined
        }
      />
    </div>
  );
}

function AnimalSelect({
  animals,
  optional,
  name = "animalId",
  fieldLabel,
}: {
  animals: AnimalOption[];
  optional?: boolean;
  name?: string;
  fieldLabel?: string;
}) {
  return (
    <div>
      <label className={label}>{fieldLabel ?? `Goat ${optional ? "(optional)" : ""}`}</label>
      <select name={name} className={field} required={!optional}>
        {optional && <option value="">—</option>}
        {animals.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function AnimalMultiSelect({ animals }: { animals: AnimalOption[] }) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set());

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(animals.map((a) => a.id)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  const count = selected.size;
  const allSelected = animals.length > 0 && count === animals.length;

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label className={label}>
          Goats {count > 0 ? `(${count} selected)` : ""}
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={allSelected ? clearAll : selectAll}
            className="text-xs font-semibold text-emerald-700"
          >
            {allSelected ? "Clear" : "Select all"}
          </button>
          {count > 0 && !allSelected && (
            <button type="button" onClick={clearAll} className="text-xs font-semibold text-stone-500">
              Clear
            </button>
          )}
        </div>
      </div>
      {animals.length === 0 ? (
        <p className="mt-1 text-sm text-stone-500">No active goats.</p>
      ) : (
        <div className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-stone-300 bg-white p-2">
          {animals.map((a) => {
            const checked = selected.has(a.id);
            return (
              <label
                key={a.id}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-stone-800 ${
                  checked ? "bg-emerald-50" : "hover:bg-stone-50"
                }`}
              >
                <input
                  type="checkbox"
                  name="animalId"
                  value={a.id}
                  checked={checked}
                  onChange={() => toggle(a.id)}
                  className="h-4 w-4 rounded border-stone-300"
                />
                {a.label}
              </label>
            );
          })}
        </div>
      )}
      <p className="mt-1 text-xs text-stone-500">
        Same event is logged for every selected goat (e.g. herd vaccine or deworming).
      </p>
    </div>
  );
}
