"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { actionLogMedical } from "@/lib/server-actions";
import { todayIso } from "@/lib/format";
import {
  DEWORM_TYPES,
  DOSE_UNITS,
  MEDICAL_ROUTES,
  type DewormType,
} from "@/lib/livestock/medical-notes";
import {
  NEW_VACCINE_VALUE,
  VACCINE_INTERVAL_PRESETS,
  type VaccineScheduleEntry,
} from "@/lib/livestock/vaccine-schedule";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Chip } from "@/components/ui/Chip";
import { SyncBadge } from "@/components/ui/SyncBadge";

const EVENT_CHIPS = ["Vaccine", "Dewormer", "FAMACHA", "Illness", "Hoof", "Other"] as const;
const EVENT_MAP: Record<string, string> = {
  Vaccine: "Vaccine",
  Dewormer: "Deworming",
  FAMACHA: "FAMACHA",
  Illness: "General",
  Hoof: "General",
  Other: "General",
};

const fieldBox =
  "mt-1 flex h-[38px] w-full items-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--field-bg)] px-2.5 text-sm";
const fieldInput =
  "mt-1 h-[38px] w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--field-bg)] px-2.5 text-sm outline-none";
const labelCls = "text-xs text-[var(--text-secondary)]";

type AnimalOption = { id: number; label: string };

export function LogHealthForm({
  animals,
  vaccineSchedules,
  dewormerNamesByType,
}: {
  animals: AnimalOption[];
  vaccineSchedules: VaccineScheduleEntry[];
  dewormerNamesByType: Record<DewormType, string[]>;
}) {
  const router = useRouter();
  const [eventChip, setEventChip] = useState<string>("Vaccine");
  const eventType = EVENT_MAP[eventChip] ?? "General";
  const [vaccineName, setVaccineName] = useState(vaccineSchedules[0]?.name ?? NEW_VACCINE_VALUE);
  const [dewormType, setDewormType] = useState<DewormType>("internal");
  const [dewormerName, setDewormerName] = useState(dewormerNamesByType.internal[0] ?? "Other");

  const dewormerOptions = dewormerNamesByType[dewormType];
  return (
    <>
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button type="button" onClick={() => router.push("/")} className="text-sm text-[var(--text-secondary)]">
          Cancel
        </button>
        <p className="text-[15px] font-semibold">Log health event</p>
        <div className="w-12" />
      </div>

      <ActionForm
        action={actionLogMedical}
        onSuccess={() => router.push("/")}
        className="px-4 pb-8"
      >
        <input type="hidden" name="eventType" value={eventType} />

        <div className="flex flex-wrap gap-2 py-3">
          {EVENT_CHIPS.map((c) => (
            <Chip
              key={c}
              label={c}
              selected={eventChip === c}
              onClick={() => setEventChip(c)}
            />
          ))}
        </div>

        <div className="mb-3">
          <p className={labelCls}>Animal</p>
          <select name="animalId" className={fieldBox} required defaultValue={animals[0]?.id}>
            {animals.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <p className={labelCls}>Date</p>
          <input name="date" type="date" className={fieldInput} defaultValue={todayIso()} required />
        </div>

        {eventChip === "Vaccine" && (
          <>
            <div className="mb-3">
              <p className={labelCls}>Disease target</p>
              <select
                name="vaccineName"
                className={fieldBox}
                required
                value={vaccineName}
                onChange={(e) => setVaccineName(e.target.value)}
              >
                {vaccineSchedules.map((v) => (
                  <option key={v.key} value={v.name}>{v.name}</option>
                ))}
                <option value={NEW_VACCINE_VALUE}>+ Add new vaccine type…</option>
              </select>
            </div>
            {vaccineName === NEW_VACCINE_VALUE && (
              <>
                <div className="mb-3">
                  <p className={labelCls}>Vaccine name</p>
                  <input name="vaccineNameOther" className={fieldInput} required />
                </div>
                <div className="mb-3">
                  <p className={labelCls}>Schedule</p>
                  <select name="vaccineIntervalDays" className={fieldBox} defaultValue={String(VACCINE_INTERVAL_PRESETS[0].value)}>
                    {VACCINE_INTERVAL_PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div className="mb-3 grid grid-cols-2 gap-2.5">
              <div>
                <p className={labelCls}>Product</p>
                <input name="productBrand" className={fieldInput} placeholder="Bar-Vac CD/T" />
              </div>
              <div>
                <p className={labelCls}>Dosage</p>
                <input name="dosage" className={fieldInput} defaultValue="1 ml" required />
              </div>
            </div>
            <DoseFields />
            <div className="mb-3">
              <p className={labelCls}>Next due</p>
              <div className={fieldBox + " text-[var(--text-muted)]"}>Auto</div>
            </div>
          </>
        )}

        {eventChip === "Dewormer" && (
          <>
            <div className="mb-3">
              <p className={labelCls}>Type</p>
              <select name="dewormType" className={fieldBox} value={dewormType} onChange={(e) => setDewormType(e.target.value as DewormType)}>
                {DEWORM_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <p className={labelCls}>Dewormer</p>
              <select name="dewormerName" className={fieldBox} value={dewormerName} onChange={(e) => setDewormerName(e.target.value)}>
                {dewormerOptions.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
                <option value="Other">Other</option>
              </select>
            </div>
            {dewormerName === "Other" && (
              <div className="mb-3">
                <input name="dewormerNameOther" className={fieldInput} required placeholder="Dewormer name" />
              </div>
            )}
            <div className="mb-3">
              <p className={labelCls}>Dosage</p>
              <input name="dosage" className={fieldInput} defaultValue="1 ml" required />
            </div>
            <DoseFields />
            <div className="mb-3 grid grid-cols-2 gap-2.5">
              <div>
                <p className={labelCls}>Meat withdrawal (days)</p>
                <input name="withdrawalMeatDays" type="number" min={0} className={fieldInput} />
              </div>
              <div>
                <p className={labelCls}>Milk withdrawal (days)</p>
                <input name="withdrawalMilkDays" type="number" min={0} className={fieldInput} />
              </div>
            </div>
          </>
        )}

        {eventChip === "FAMACHA" && (
          <>
            <div className="mb-3">
              <p className={labelCls}>FAMACHA score (1–5)</p>
              <div className="mt-1 flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className="flex-1">
                    <input type="radio" name="famachaScore" value={n} className="peer sr-only" required />
                    <span className="flex h-11 items-center justify-center rounded-[var(--radius)] border border-[var(--border)] peer-checked:border-[var(--accent-border)] peer-checked:bg-[var(--accent-bg)] peer-checked:text-[var(--accent-text)]">
                      {n}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="mb-3">
              <p className={labelCls}>Body condition (optional)</p>
              <input name="bodyConditionScore" type="number" min={1} max={5} step={0.5} className={fieldInput} />
            </div>
          </>
        )}

        {(eventChip === "Illness" || eventChip === "Hoof" || eventChip === "Other") && (
          <div className="mb-3">
            <p className={labelCls}>Notes</p>
            <textarea name="notes" rows={3} className="mt-1 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-2 text-sm" />
          </div>
        )}

        <div className="mb-3">
          <p className={labelCls}>Notes</p>
          <textarea name="comment" rows={2} className="mt-1 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-2 text-sm" placeholder="Additional context" />
        </div>

        <button type="button" className="mb-4 flex h-[38px] w-full items-center justify-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card-bg)] text-sm">
          <Camera className="h-4 w-4" strokeWidth={1.8} />
          Add photo of vial or label
        </button>

        <SyncBadge />
        <SubmitButton label="Save" />
      </ActionForm>
    </>
  );
}

function DoseFields() {
  return (
    <div className="mb-3 grid grid-cols-3 gap-2.5">
      <div>
        <p className={labelCls}>Dose</p>
        <input name="doseAmount" type="number" min={0} step="any" className={fieldInput} />
      </div>
      <div>
        <p className={labelCls}>Unit</p>
        <select name="doseUnit" className={fieldBox}>
          <option value="">—</option>
          {DOSE_UNITS.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>
      <div>
        <p className={labelCls}>Route</p>
        <select name="route" className={fieldBox} defaultValue="SQ">
          {MEDICAL_ROUTES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
