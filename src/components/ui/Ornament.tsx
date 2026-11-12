/** Decorative gold divider: line, diamond, line. */
export function Ornament({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`flex items-center gap-2 text-gold ${className}`}>
      <span className="h-px w-10 bg-gold/60" />
      <svg viewBox="0 0 24 12" className="h-3 w-6" fill="currentColor">
        <path d="M12 0 18 6 12 12 6 6Z" />
        <path d="M3 4 5 6 3 8 1 6Z M21 4 23 6 21 8 19 6Z" />
      </svg>
      <span className="h-px w-10 bg-gold/60" />
    </span>
  );
}

/** Small pointed-arch mark used beside the site name. */
export function ArchMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 28" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 27V13c0-4 4-5 6.5-7.5C10.800 4.200 11.500 3 12 1.500c.5 1.500 1.200 2.700 2.500 4C17 8 21 9 21 13v14" />
      <path d="M7.500 27V14.500c0-2.300 2.500-3 4.500-5.500 2 2.500 4.500 3.200 4.500 5.500V27" opacity=".55" />
    </svg>
  );
}
