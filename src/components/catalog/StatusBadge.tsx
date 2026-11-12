export function SoldBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-ink px-3 py-1 text-[0.7rem] font-semibold tracking-[0.16em] text-white uppercase ${className}`}
    >
      Sold
    </span>
  );
}

export function AvailableBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 ${className}`}
    >
      <span className="size-1.5 rounded-full bg-emerald-600" aria-hidden />
      Available
    </span>
  );
}
