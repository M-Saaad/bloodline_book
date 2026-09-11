import Link from "next/link";
import { Home, Bell, Plus, Stethoscope } from "lucide-react";

export type NavKey = "home" | "animals" | "health" | "more";

const tabs: { href: string; label: string; active: NavKey; icon: typeof Home }[] = [
  { href: "/", label: "Home", active: "home", icon: Home },
  { href: "/animals", label: "Animals", active: "animals", icon: Bell },
  { href: "/health", label: "Health", active: "health", icon: Stethoscope },
  { href: "/vet", label: "More", active: "more", icon: Plus },
];

export function BottomNav({ active }: { active: NavKey }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] bg-[var(--card-bg)]">
      <div className="mx-auto flex max-w-lg justify-around px-1 py-2">
        {tabs.map((t) => {
          const isActive = active === t.active;
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-col items-center gap-0.5 rounded-[var(--radius)] px-2.5 py-1.5 text-[11px] ${
                isActive ? "text-[var(--accent-text)]" : "text-[var(--text-secondary)]"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={1.8} />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
