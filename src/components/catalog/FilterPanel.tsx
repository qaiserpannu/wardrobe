import type { ReactNode } from "react";
import { SearchIcon } from "@/components/ui/icons";
import { SORTS, SORT_LABELS, countActiveFilters, type CatalogFilters } from "@/lib/catalog-params";
import { CONDITIONS, CONDITION_LABELS } from "@/lib/conditions";
import type { CatalogFacets, PublicCategory } from "@/server/services/types";
import { FilterForm } from "./FilterForm";

type Props = {
  filters: CatalogFilters;
  categories: PublicCategory[];
  facets: CatalogFacets;
  currency: string;
};

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-line py-5">
      <legend className="float-left mb-3 w-full text-xs font-semibold tracking-[0.18em] uppercase">{title}</legend>
      <div className="clear-both">{children}</div>
    </fieldset>
  );
}

function Check({
  name,
  value,
  label,
  checked,
  type = "checkbox",
  hint,
}: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  type?: "checkbox" | "radio";
  hint?: string;
}) {
  return (
    <label className="flex min-h-9 cursor-pointer items-center gap-2.5 text-sm">
      <input type={type} name={name} value={value} defaultChecked={checked} className="size-4 accent-ink" />
      <span>{label}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function FilterPanel({ filters, categories, facets, currency }: Props) {
  return (
    <FilterForm urlKey={JSON.stringify(filters)} activeCount={countActiveFilters(filters)}>
      <div className="pb-5">
        <label htmlFor="filter-q" className="sr-only">
          Search by name or keyword
        </label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
          <input
            id="filter-q"
            type="search"
            name="q"
            defaultValue={filters.q}
            maxLength={100}
            placeholder="Search by name or keyword"
            className="h-12 w-full rounded-full border border-line bg-surface pr-4 pl-10 text-sm placeholder:text-muted"
          />
        </div>
      </div>

      <Group title="Sort by">
        <label htmlFor="filter-sort" className="sr-only">
          Sort by
        </label>
        <select
          id="filter-sort"
          name="sort"
          defaultValue={filters.sort}
          className="h-11 w-full rounded-md border border-line bg-surface px-3 text-sm"
        >
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {SORT_LABELS[s]}
            </option>
          ))}
        </select>
      </Group>

      <Group title="Category">
        <Check type="radio" name="category" value="" label="All categories" checked={!filters.category} />
        {categories.map((c) => (
          <Check
            key={c.slug}
            type="radio"
            name="category"
            value={c.slug}
            label={c.name}
            hint={`(${c.availableCount})`}
            checked={filters.category === c.slug}
          />
        ))}
      </Group>

      {facets.sizes.length > 0 && (
        <Group title="Size">
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((size) => (
              <label key={size} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="size"
                  value={size}
                  defaultChecked={filters.sizes.includes(size)}
                  className="peer sr-only"
                />
                <span className="flex h-10 min-w-11 items-center justify-center rounded-md border border-line bg-surface px-2.5 text-sm peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                  {size}
                </span>
              </label>
            ))}
          </div>
        </Group>
      )}

      {facets.brands.length > 0 && (
        <Group title="Brand">
          <div className="max-h-56 overflow-y-auto pr-1">
            {facets.brands.map((brand) => (
              <Check key={brand} name="brand" value={brand} label={brand} checked={filters.brands.includes(brand)} />
            ))}
          </div>
        </Group>
      )}

      <Group title="Condition">
        {CONDITIONS.map((c) => (
          <Check
            key={c}
            name="condition"
            value={c}
            label={CONDITION_LABELS[c]}
            checked={filters.conditions.includes(c)}
          />
        ))}
      </Group>

      <Group title={`Price (${currency})`}>
        <div className="flex items-center gap-2">
          <label htmlFor="filter-min" className="sr-only">
            Minimum price
          </label>
          <input
            id="filter-min"
            type="number"
            name="min"
            min={0}
            step="any"
            inputMode="decimal"
            placeholder="Min"
            defaultValue={filters.minPriceCents != null ? filters.minPriceCents / 100 : ""}
            className="h-11 w-full rounded-md border border-line bg-surface px-3 text-sm"
          />
          <span className="text-muted">–</span>
          <label htmlFor="filter-max" className="sr-only">
            Maximum price
          </label>
          <input
            id="filter-max"
            type="number"
            name="max"
            min={0}
            step="any"
            inputMode="decimal"
            placeholder="Max"
            defaultValue={filters.maxPriceCents != null ? filters.maxPriceCents / 100 : ""}
            className="h-11 w-full rounded-md border border-line bg-surface px-3 text-sm"
          />
        </div>
      </Group>

      <Group title="Availability">
        <Check name="hideSold" value="1" label="Hide sold items" checked={filters.hideSold} />
      </Group>

      <button
        type="submit"
        className="mt-1 min-h-12 w-full rounded-full bg-ink text-sm font-medium tracking-wide text-white hover:bg-accent-dark"
      >
        Apply
      </button>
    </FilterForm>
  );
}
