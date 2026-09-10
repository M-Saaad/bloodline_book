"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Stethoscope,
  Heart,
  Droplet,
  Scale,
  Camera,
  MoreHorizontal,
} from "lucide-react";
import { useState } from "react";

const entries: { href?: string; label: string; icon: LucideIcon; action?: "more" }[] = [
  { href: "/health/log", label: "Log health", icon: Stethoscope },
  { href: "/breeding/record", label: "Breeding", icon: Heart },
  { href: "/milk/log", label: "Log milk", icon: Droplet },
  { href: "/weight/log", label: "Weigh", icon: Scale },
  { href: "/photo/log", label: "Photo", icon: Camera },
  { action: "more", label: "More", icon: MoreHorizontal },
];

export function QuickEntryGrid() {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <div className="grid grid-cols-3 gap-2.5">
        {entries.map((e) => {
          const Icon = e.icon;
          if (e.action === "more") {
            return (
              <button
                key={e.label}
                type="button"
                onClick={() => setMoreOpen(true)}
                className="flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card-bg)] text-xs text-[var(--text-primary)] active:bg-[var(--field-bg)]"
              >
                <Icon className="h-5 w-5" strokeWidth={1.8} />
                {e.label}
              </button>
            );
          }
          return (
            <Link
              key={e.label}
              href={e.href!}
              className="flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card-bg)] text-xs text-[var(--text-primary)] active:bg-[var(--field-bg)]"
            >
              <Icon className="h-5 w-5" strokeWidth={1.8} />
              {e.label}
            </Link>
          );
        })}
      </div>

      {moreOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setMoreOpen(false)}>
          <div
            className="w-full max-w-lg rounded-t-2xl bg-[var(--card-bg)] p-4"
            onClick={(ev) => ev.stopPropagation()}
          >
            <p className="mb-3 text-sm font-semibold text-[var(--text-primary)]">More</p>
            <div className="space-y-2">
              <Link
                href="/transactions"
                className="block rounded-[var(--radius)] border border-[var(--border)] px-4 py-3 text-sm"
                onClick={() => setMoreOpen(false)}
              >
                Transactions
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
