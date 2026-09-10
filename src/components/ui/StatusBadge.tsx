export type StatusBadgeVariant = "success" | "warning" | "accent" | "neutral";

const variants: Record<StatusBadgeVariant, string> = {
  success: "bg-[var(--success-bg)] text-[var(--success-text)]",
  warning: "bg-[var(--warning-bg)] text-[var(--warning-text)]",
  accent: "bg-[var(--accent-bg)] text-[var(--accent-text)]",
  neutral: "border border-[var(--border)] text-[var(--text-secondary)]",
};

export function StatusBadge({ label, variant }: { label: string; variant: StatusBadgeVariant }) {
  return (
    <span className={`shrink-0 rounded-[var(--radius)] px-2 py-0.5 text-[11px] whitespace-nowrap ${variants[variant]}`}>
      {label}
    </span>
  );
}
