export function AppHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{eyebrow}</p>
        <h1 className="text-2xl font-bold text-stone-900">{title}</h1>
        {subtitle && <p className="text-sm text-stone-500">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
