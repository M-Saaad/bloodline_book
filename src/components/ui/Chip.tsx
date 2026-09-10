"use client";

export function Chip({
  label,
  selected = false,
  onClick,
  type = "button",
}: {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`shrink-0 rounded-[var(--radius)] border px-3 py-1.5 text-xs ${
        selected
          ? "border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-text)]"
          : "border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-secondary)]"
      }`}
    >
      {label}
    </button>
  );
}

export function ChipStatic({ label, selected = false }: { label: string; selected?: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-[var(--radius)] border px-3 py-1.5 text-xs ${
        selected
          ? "border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent-text)]"
          : "border-[var(--border)] bg-[var(--card-bg)] text-[var(--text-secondary)]"
      }`}
    >
      {label}
    </span>
  );
}
