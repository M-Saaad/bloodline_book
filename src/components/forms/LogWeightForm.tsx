"use client";

import { useRouter } from "next/navigation";
import { actionLogWeight } from "@/lib/server-actions";
import { todayIso } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { SyncBadge } from "@/components/ui/SyncBadge";

const fieldInput =
  "mt-1 h-[38px] w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--field-bg)] px-2.5 text-sm outline-none";
const fieldBox =
  "mt-1 flex h-[38px] w-full items-center rounded-[var(--radius)] border border-[var(--border)] bg-[var(--field-bg)] px-2.5 text-sm";
const labelCls = "text-xs text-[var(--text-secondary)]";

type AnimalOption = { id: number; label: string };

export function LogWeightForm({ animals }: { animals: AnimalOption[] }) {
  const router = useRouter();

  return (
    <>
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button type="button" onClick={() => router.push("/")} className="text-sm text-[var(--text-secondary)]">
          Cancel
        </button>
        <p className="text-[15px] font-semibold">Log weight</p>
        <div className="w-12" />
      </div>

      <ActionForm action={actionLogWeight} onSuccess={() => router.push("/")} className="px-4 pb-8">
        <div className="mb-3 py-3">
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
        <div className="mb-3">
          <p className={labelCls}>Weight (kg)</p>
          <input name="weightKg" type="number" min={0} step="any" className={fieldInput} required />
        </div>
        <div className="mb-3">
          <p className={labelCls}>Notes</p>
          <textarea name="notes" rows={2} className="mt-1 w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--field-bg)] px-2.5 py-2 text-sm" />
        </div>
        <SyncBadge />
        <SubmitButton label="Save" />
      </ActionForm>
    </>
  );
}
