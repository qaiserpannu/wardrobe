"use client";

import { type ReactNode, useActionState } from "react";
import { type ActionState, saveProductAction } from "@/app/admin/(portal)/products/actions";
import { CONDITION_DESCRIPTIONS, CONDITION_LABELS, CONDITIONS } from "@/lib/conditions";
import { OCCASION_LABELS, OCCASIONS, STITCHING, STITCHING_LABELS } from "@/lib/product-options";
import { inputClass, labelClass, primaryButtonClass } from "./fields";

export type ProductFormValues = {
  id?: string;
  name: string;
  description: string;
  categoryId: string;
  brand: string;
  size: string;
  color: string;
  fabric: string;
  pieces: string;
  stitching: string;
  occasion: string;
  imperfections: string;
  condition: string;
  price: string;
  isFeatured: boolean;
};

type Props = {
  values: ProductFormValues;
  categories: { id: string; label: string; isActive: boolean }[];
  /** Values already used in the shop, offered as suggestions while typing. */
  suggestions: { brands: string[]; sizes: string[]; colors: string[]; fabrics: string[] };
};

const initial: ActionState = {};

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && !error && <p className="mt-1.5 text-sm text-muted">{hint}</p>}
      {error && (
        <p className="mt-1.5 text-sm text-accent" data-testid={`error-${id}`}>
          {error}
        </p>
      )}
    </div>
  );
}

export function ProductForm({ values: saved, categories, suggestions }: Props) {
  const [state, action, pending] = useActionState(saveProductAction, initial);
  const errors = state.fieldErrors ?? {};
  const isNew = !saved.id;
  // After a failed save, show what was typed rather than the last saved values.
  const typed = state.values;
  const values: ProductFormValues = typed
    ? { ...saved, ...typed, id: saved.id, isFeatured: typed.isFeatured === "on" }
    : saved;

  const suggest = (id: string, options: string[]) => (
    <datalist id={id}>
      {options.map((o) => (
        <option key={o} value={o} />
      ))}
    </datalist>
  );

  return (
    <form action={action} key={typed ? JSON.stringify(typed) : "saved"} className="space-y-6" data-testid="product-form" noValidate>
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <Field id="name" label="Name" hint="For example: Teal Embroidered Lawn Suit" error={errors.name}>
        <input id="name" name="name" required maxLength={120} defaultValue={values.name} className={inputClass} />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="categoryId" label="Category" error={errors.categoryId}>
          <select id="categoryId" name="categoryId" required defaultValue={values.categoryId} className={inputClass}>
            <option value="">Choose…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
                {c.isActive ? "" : " (hidden)"}
              </option>
            ))}
          </select>
        </Field>
        <Field id="price" label="Price (US dollars)" error={errors.price}>
          <input id="price" name="price" inputMode="decimal" required maxLength={12} defaultValue={values.price} placeholder="45" className={inputClass} />
        </Field>
      </div>

      <Field id="description" label="Description" hint="What it is, how it was worn, anything a buyer would want to know." error={errors.description}>
        <textarea id="description" name="description" rows={4} maxLength={4000} defaultValue={values.description} className={inputClass} />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="condition" label="Condition" error={errors.condition}>
          <select id="condition" name="condition" required defaultValue={values.condition} className={inputClass}>
            <option value="">Choose…</option>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {CONDITION_LABELS[c]}: {CONDITION_DESCRIPTIONS[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="size" label="Size" hint="As on the label: S, M, 38, Free size…" error={errors.size}>
          <input id="size" name="size" maxLength={40} defaultValue={values.size} list="size-options" className={inputClass} />
          {suggest("size-options", suggestions.sizes)}
        </Field>
        <Field id="brand" label="Brand or designer" error={errors.brand}>
          <input id="brand" name="brand" maxLength={60} defaultValue={values.brand} list="brand-options" className={inputClass} />
          {suggest("brand-options", suggestions.brands)}
        </Field>
        <Field id="color" label="Colour" error={errors.color}>
          <input id="color" name="color" maxLength={40} defaultValue={values.color} list="color-options" className={inputClass} />
          {suggest("color-options", suggestions.colors)}
        </Field>
        <Field id="fabric" label="Fabric" error={errors.fabric}>
          <input id="fabric" name="fabric" maxLength={60} defaultValue={values.fabric} list="fabric-options" className={inputClass} />
          {suggest("fabric-options", suggestions.fabrics)}
        </Field>
        <Field id="pieces" label="Number of pieces" hint="A 3-piece suit is 3." error={errors.pieces}>
          <input id="pieces" name="pieces" type="number" min={1} max={12} defaultValue={values.pieces} className={inputClass} />
        </Field>
        <Field id="stitching" label="Stitching" error={errors.stitching}>
          <select id="stitching" name="stitching" defaultValue={values.stitching} className={inputClass}>
            <option value="">Not specified</option>
            {STITCHING.map((s) => (
              <option key={s} value={s}>
                {STITCHING_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="occasion" label="Occasion" error={errors.occasion}>
          <select id="occasion" name="occasion" defaultValue={values.occasion} className={inputClass}>
            <option value="">Not specified</option>
            {OCCASIONS.map((o) => (
              <option key={o} value={o}>
                {OCCASION_LABELS[o]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        id="imperfections"
        label="Imperfections"
        hint="Marks, loose threads, alterations, fading. Leave empty if you have not checked yet; write “None noticed” if you have."
        error={errors.imperfections}
      >
        <textarea id="imperfections" name="imperfections" rows={3} maxLength={1000} defaultValue={values.imperfections} className={inputClass} />
      </Field>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="isFeatured" defaultChecked={values.isFeatured} className="mt-0.5 size-5 accent-accent" />
        <span>
          <span className="font-medium">Feature on the homepage</span>
          <span className="block text-muted">Shown in “Featured pieces” while the item is available.</span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Saving…" : isNew ? "Save as draft and add photos" : "Save changes"}
        </button>
        <p role="status" aria-live="polite" className="text-sm" data-testid="form-message">
          {state.error && <span className="text-accent">{state.error}</span>}
          {state.success && <span className="text-whatsapp-dark">{state.success}</span>}
        </p>
      </div>
    </form>
  );
}
