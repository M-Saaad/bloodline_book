"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actionLogMilkBatch } from "@/lib/server-actions";
import { todayIso } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { Chip } from "@/components/ui/Chip";
import { SyncBadge } from "@/components/ui/SyncBadge";

type DoeRow = { id: number; barnName: string; initials: string };

export function LogMilkForm({ does }: { does: DoeRow[] }) {
  const router = useRouter();
  const [session, setSession] = useState<"AM" | "PM">("AM");
  const [unit, setUnit] = useState<"lb" | "fl-oz">("lb");
  const [date, setDate] = useState(todayIso());
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const entries = does
        .map((d) => ({ animalId: d.id, amount: amounts[d.id]?.trim() }))
        .filter((e) => e.amount && Number(e.amount) > 0);

      if (entries.length === 0) {
        alert("Enter at least one milk amount");
        return;
      }

      const formData = new FormData();
      formData.set("date", date);
      formData.set("session", session);
      formData.set("unit", unit === "fl-oz" ? "fl-oz" : "lb");
      formData.set("entries", JSON.stringify(entries));
      await actionLogMilkBatch(formData);
      router.push("/");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button type="button" onClick={() => router.push("/")} className="text-sm text-[var(--text-secondary)]">
          Cancel
        </button>
        <p className="text-[15px] font-semibold">Log milk</p>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="text-sm font-semibold text-[var(--accent-text)] disabled:opacity-40"
        >
          Save
        </button>
      </div>

      <div className="px-4 pb-8">
        <div className="flex items-center justify-between py-3">
          <div className="flex gap-2">
            <Chip label="AM" selected={session === "AM"} onClick={() => setSession("AM")} />
            <Chip label="PM" selected={session === "PM"} onClick={() => setSession("PM")} />
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-xs text-[var(--text-secondary)]"
          />
        </div>

        {does.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--text-secondary)]">
            No does currently in milk
          </p>
        ) : (
          <div className="border-t border-[var(--border)]">
            {does.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between border-b border-[var(--border)] py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar initials={d.initials} size="sm" />
                  <span className="text-[13px]">{d.barnName}</span>
                </div>
                <input
                  type="number"
                  min={0}
                  step="any"
                  placeholder={`-- ${unit}`}
                  value={amounts[d.id] ?? ""}
                  onChange={(e) => setAmounts((prev) => ({ ...prev, [d.id]: e.target.value }))}
                  className="h-8 w-[76px] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--field-bg)] text-center text-sm placeholder:text-[var(--text-muted)]"
                />
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setUnit((u) => (u === "lb" ? "fl-oz" : "lb"))}
          className="mt-2.5 text-[11px] text-[var(--text-muted)]"
        >
          Showing does currently in milk. Unit defaults to {unit === "lb" ? "pounds" : "fl oz"} — tap to switch to{" "}
          {unit === "lb" ? "fl oz" : "lb"}.
        </button>

        <SyncBadge pending={saving} />
      </div>
    </>
  );
}
