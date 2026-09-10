import Link from "next/link";

export function MetricCard({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href?: string;
}) {
  const inner = (
    <div className="rounded-[var(--radius)] bg-[var(--field-bg)] p-2.5 text-left">
      <p className="text-xs text-[var(--text-secondary)]">{label}</p>
      <p className="mt-0.5 text-[22px] font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
  if (href) {
    return <Link href={href} className="block">{inner}</Link>;
  }
  return inner;
}
