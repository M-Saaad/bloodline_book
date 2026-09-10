import { Bell } from "lucide-react";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function HomeHeader({ farmName }: { farmName: string }) {
  const greeting = greetingForHour(new Date().getHours());
  return (
    <div className="flex items-start justify-between px-4 pb-3 pt-4">
      <div>
        <p className="text-[13px] text-[var(--text-secondary)]">{greeting}</p>
        <p className="mt-0.5 text-lg font-semibold text-[var(--text-primary)]">{farmName}</p>
      </div>
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--field-bg)] text-[var(--text-secondary)]"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" strokeWidth={1.8} />
      </button>
    </div>
  );
}
