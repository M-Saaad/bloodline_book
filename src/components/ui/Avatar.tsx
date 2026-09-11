export function Avatar({
  initials,
  size = "md",
  className = "",
}: {
  initials: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "h-[30px] w-[30px] text-[11px]",
    md: "h-9 w-9 text-xs",
    lg: "h-[72px] w-[72px] text-xl",
  };
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--accent-bg)] font-semibold text-[var(--accent-text)] ${sizes[size]} ${className}`}
    >
      {initials}
    </div>
  );
}
