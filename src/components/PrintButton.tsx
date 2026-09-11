"use client";

export function PrintButton({ label = "Print / PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="text-sm font-semibold text-emerald-800"
    >
      {label}
    </button>
  );
}
