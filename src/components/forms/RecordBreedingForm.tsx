"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actionRecordBreeding } from "@/lib/server-actions";
import { todayIso } from "@/lib/format";
import { dueDateRange, DEFAULT_FARM_SETTINGS } from "@/lib/livestock/breeding";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Chip } from "@/components/ui/Chip";
import { BuckSelect } from "@/components/ContactSelect";
import { SyncBadge } from "@/components/ui/SyncBadge";

const METHODS = ["Pasture exposure", "Hand mating", "AI"] as const;

const fieldBox =
  "mt-1 flex h-[38px] w-full items-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--field-bg)] px-2.5 text-sm";
const fieldInput =
  "mt-1 h-[38px] w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--field-bg)] px-2.5 text-sm outline-none";
const labelCls = "text-xs text-[var(--text-secondary)]";

type AnimalOption = { id: number; label: string };

export function RecordBreedingForm({
  femaleAnimals,
  maleAnimals,
  pastBuckNames,
}: {
  femaleAnimals: AnimalOption[];
  maleAnimals: AnimalOption[];
  pastBuckNames: string[];
}) {
  const router = useRouter();
  const [method, setMethod] = useState<string>(METHODS[0]);
  const [exposureStart, setExposureStart] = useState(todayIso());
  const [exposureEnd, setExposureEnd] = useState(todayIso());

  const dueWindow =
    exposureStart && exposureEnd
      ? dueDateRange(exposureEnd, DEFAULT_FARM_SETTINGS)
      : null;

  return (
    <>
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button type="button" onClick={() => router.push("/")} className="text-sm text-[var(--text-secondary)]">
          Cancel
        </button>
        <p className="text-[15px] font-semibold">Record breeding</p>
        <div className="w-12" />
      </div>

      <ActionForm action={actionRecordBreeding} onSuccess={() => router.push("/")} className="px-4 pb-8">
        <input type="hidden" name="method" value={method} />

        <div className="mb-3 py-3">
          <p className={labelCls}>Doe</p>
          <select name="femaleId" className={fieldBox} required defaultValue={femaleAnimals[0]?.id}>
            {femaleAnimals.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <BuckSelect maleAnimals={maleAnimals} pastNames={pastBuckNames} />
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {METHODS.map((m) => (
            <Chip key={m} label={m} selected={method === m} onClick={() => setMethod(m)} />
          ))}
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <div>
            <p className={labelCls}>Exposure start</p>
            <input
              name="exposureStart"
              type="date"
              className={fieldInput}
              value={exposureStart}
              onChange={(e) => setExposureStart(e.target.value)}
              required
            />
          </div>
          <div>
            <p className={labelCls}>Exposure end</p>
            <input
              name="exposureEnd"
              type="date"
              className={fieldInput}
              value={exposureEnd}
              onChange={(e) => setExposureEnd(e.target.value)}
              required
            />
          </div>
        </div>

        {dueWindow && (
          <div className="mb-4 rounded-[var(--radius-card)] bg-[var(--accent-bg)] p-3">
            <p className="text-xs text-[var(--accent-text)]">Expected kidding window</p>
            <p className="mt-1 text-[15px] font-semibold text-[var(--accent-text)]">
              {dueWindow.early} — {dueWindow.late}
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--accent-text)]">
              Based on {DEFAULT_FARM_SETTINGS.gestation_days - DEFAULT_FARM_SETTINGS.gestation_early_days}–
              {DEFAULT_FARM_SETTINGS.gestation_days + DEFAULT_FARM_SETTINGS.gestation_late_days} day gestation
            </p>
          </div>
        )}

        <SyncBadge />
        <SubmitButton label="Save" />
      </ActionForm>
    </>
  );
}
