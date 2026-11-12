import Link from "next/link";
import { catalogHref, type CatalogFilters } from "@/lib/catalog-params";

export function Pagination({ filters, page, pageCount }: { filters: CatalogFilters; page: number; pageCount: number }) {
  if (pageCount <= 1) return null;
  const link = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border px-4 text-sm";

  return (
    <nav aria-label="Pages" className="mt-14 flex items-center justify-center gap-2">
      {page > 1 && (
        <Link href={catalogHref({ ...filters, page: page - 1 })} className={`${link} border-line hover:border-ink`}>
          Previous
        </Link>
      )}
      <ul className="flex items-center gap-2">
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
          <li key={n}>
            <Link
              href={catalogHref({ ...filters, page: n })}
              aria-current={n === page ? "page" : undefined}
              aria-label={`Page ${n}`}
              className={`${link} ${n === page ? "border-ink bg-ink text-white" : "border-line hover:border-ink"}`}
            >
              {n}
            </Link>
          </li>
        ))}
      </ul>
      {page < pageCount && (
        <Link href={catalogHref({ ...filters, page: page + 1 })} className={`${link} border-line hover:border-ink`}>
          Next
        </Link>
      )}
    </nav>
  );
}
