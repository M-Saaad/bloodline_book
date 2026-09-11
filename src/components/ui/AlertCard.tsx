import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export type AlertSeverity = "danger" | "warning" | "accent";

const styles: Record<AlertSeverity, { bg: string; text: string }> = {
  danger: { bg: "bg-[var(--danger-bg)]", text: "text-[var(--danger-text)]" },
  warning: { bg: "bg-[var(--warning-bg)]", text: "text-[var(--warning-text)]" },
  accent: { bg: "bg-[var(--accent-bg)]", text: "text-[var(--accent-text)]" },
};

export function AlertCard({
  href,
  icon: Icon,
  headline,
  subline,
  severity,
}: {
  href: string;
  icon: LucideIcon;
  headline: string;
  subline: string;
  severity: AlertSeverity;
}) {
  const s = styles[severity];
  return (
    <Link
      href={href}
      className={`mb-2 flex items-center gap-2.5 rounded-[var(--radius-card)] px-3 py-2.5 ${s.bg}`}
    >
      <Icon className={`h-5 w-5 shrink-0 ${s.text}`} strokeWidth={1.8} />
      <div className="min-w-0">
        <p className={`text-[13px] font-semibold ${s.text}`}>{headline}</p>
        <p className={`text-xs ${s.text}`}>{subline}</p>
      </div>
    </Link>
  );
}
