import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Stethoscope, Droplet, Scale, Camera } from "lucide-react";

const entries: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/health/log", label: "Log health", icon: Stethoscope },
  { href: "/milk/log", label: "Log milk", icon: Droplet },
  { href: "/weight/log", label: "Weigh", icon: Scale },
  { href: "/photo/log", label: "Photo", icon: Camera },
];

export function QuickEntryGrid() {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {entries.map((e) => {
        const Icon = e.icon;
        return (
          <Link
            key={e.label}
            href={e.href}
            className="flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card-bg)] text-xs text-[var(--text-primary)] active:bg-[var(--field-bg)]"
          >
            <Icon className="h-5 w-5" strokeWidth={1.8} />
            {e.label}
          </Link>
        );
      })}
    </div>
  );
}
