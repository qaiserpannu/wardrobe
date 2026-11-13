"use client";

import { type FormEvent, useState, useTransition } from "react";
import {
  type CategoryResult,
  createCategoryAction,
  moveCategoryAction,
  renameCategoryAction,
  setCategoryActiveAction,
  setCategoryParentAction,
} from "@/app/admin/(portal)/categories/actions";
import { inputClass, primaryButtonClass } from "./fields";

type Category = { id: string; name: string; slug: string; isActive: boolean; itemCount: number };
type Group = Category & { children: Category[] };

const small =
  "inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-line bg-white px-2.5 text-sm hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink";

export function CategoryManager({ groups, groupOptions }: { groups: Group[]; groupOptions: { id: string; name: string }[] }) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  function run(task: () => Promise<CategoryResult>, after?: () => void) {
    startTransition(async () => {
      const result = await task();
      setError(result.error ?? null);
      if (!result.error) after?.();
    });
  }

  function add(event: FormEvent<HTMLFormElement>, parentId: string | null) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "");
    run(
      () => createCategoryAction(name, parentId),
      () => form.reset(),
    );
  }

  function row(category: Category, index: number, count: number, parentId: string | null, hiddenByGroup: boolean) {
    const isGroup = parentId === null;
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5" data-testid="category-row" data-name={category.name}>
        {renaming === category.id ? (
          <form
            className="flex min-w-0 flex-1 gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const name = String(new FormData(event.currentTarget).get("name") ?? "");
              run(
                () => renameCategoryAction(category.id, name),
                () => setRenaming(null),
              );
            }}
          >
            <input name="name" defaultValue={category.name} maxLength={40} required autoFocus aria-label={`New name for ${category.name}`} className={inputClass} />
            <button type="submit" disabled={busy} className={small}>
              Save
            </button>
            <button type="button" className={small} onClick={() => setRenaming(null)}>
              Cancel
            </button>
          </form>
        ) : (
          <p className="min-w-0 flex-1">
            <span className={`${isGroup ? "font-display text-xl font-medium" : "font-medium"} ${category.isActive ? "" : "text-muted line-through"}`}>
              {category.name}
            </span>{" "}
            <span className="text-sm text-muted">
              {isGroup && count > 0 ? "" : `${category.itemCount} ${category.itemCount === 1 ? "item" : "items"}`}
              {!category.isActive ? " · hidden" : hiddenByGroup ? " · hidden with its group" : ""}
            </span>
          </p>
        )}
        {renaming !== category.id && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" className={small} disabled={busy || index === 0} onClick={() => run(() => moveCategoryAction(category.id, "up"))} aria-label={`Move ${category.name} up`}>
              ↑
            </button>
            <button
              type="button"
              className={small}
              disabled={busy || index === (isGroup ? groups.length : (groups.find((g) => g.id === parentId)?.children.length ?? 0)) - 1}
              onClick={() => run(() => moveCategoryAction(category.id, "down"))}
              aria-label={`Move ${category.name} down`}
            >
              ↓
            </button>
            <button type="button" className={small} disabled={busy} onClick={() => setRenaming(category.id)} aria-label={`Rename ${category.name}`}>
              Rename
            </button>
            <button
              type="button"
              className={small}
              disabled={busy}
              onClick={() => {
                const what = category.isActive
                  ? `Hide “${category.name}”? It and every item in it will disappear from the website until you show it again.`
                  : null;
                if (!what || window.confirm(what)) run(() => setCategoryActiveAction(category.id, !category.isActive));
              }}
              aria-label={`${category.isActive ? "Hide" : "Show"} ${category.name}`}
            >
              {category.isActive ? "Hide" : "Show"}
            </button>
            {count === 0 && (
              <select
                className={`${small} max-w-36`}
                disabled={busy}
                value={parentId ?? ""}
                onChange={(event) => run(() => setCategoryParentAction(category.id, event.target.value || null))}
                aria-label={`Group for ${category.name}`}
              >
                <option value="">Top level</option>
                {groupOptions
                  .filter((g) => g.id !== category.id)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      In {g.name}
                    </option>
                  ))}
                {/* The current group may itself not be offered to others, but must be shown here. */}
                {parentId && !groupOptions.some((g) => g.id === parentId) && <option value={parentId}>Current group</option>}
              </select>
            )}
          </div>
        )}
      </div>
    );
  }

  const addForm = (parentId: string | null, label: string, testId: string) => (
    <form onSubmit={(event) => add(event, parentId)} className="flex max-w-md gap-2" data-testid={testId}>
      <input name="name" maxLength={40} required placeholder={label} aria-label={label} className={inputClass} />
      <button type="submit" disabled={busy} className={primaryButtonClass}>
        Add
      </button>
    </form>
  );

  return (
    <div data-testid="category-manager">
      <p role="alert" aria-live="polite" className="mb-3 min-h-5 text-sm text-accent" data-testid="category-error">
        {error}
      </p>
      <div className="space-y-5">
        {groups.map((group, groupIndex) => (
          <section key={group.id} className="rounded-2xl border border-line bg-surface p-4 sm:p-5" data-testid="category-group" data-name={group.name}>
            {row(group, groupIndex, group.children.length, null, false)}
            <ul className="divide-y divide-line border-t border-line pl-3 sm:pl-6">
              {group.children.map((child, childIndex) => (
                <li key={child.id}>{row(child, childIndex, 0, group.id, !group.isActive)}</li>
              ))}
            </ul>
            {group.itemCount === 0 && <div className="mt-3 pl-3 sm:pl-6">{addForm(group.id, `New category in ${group.name}`, "add-child")}</div>}
          </section>
        ))}
      </div>
      <section className="mt-6 rounded-2xl border border-dashed border-line p-4 sm:p-5">
        <h2 className="mb-3 font-display text-xl font-medium">Add a top-level group</h2>
        {addForm(null, "New group name", "add-group")}
      </section>
    </div>
  );
}
