"use client";

import { useActionState } from "react";
import { saveSettingsAction, type SettingsState } from "@/app/admin/(portal)/settings/actions";
import { fieldName, SETTINGS_SECTIONS } from "@/lib/settings-form";
import { inputClass, labelClass, primaryButtonClass } from "./fields";

const initial: SettingsState = {};

/** One card of the settings page. Each section saves on its own. */
export function SettingsSectionForm({ sectionId, values: saved }: { sectionId: string; values: Record<string, string | boolean> }) {
  const [state, action, pending] = useActionState(saveSettingsAction, initial);
  const section = SETTINGS_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return null;
  const typed = state.values;
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} key={typed ? JSON.stringify(typed) : "saved"} className="space-y-5" data-testid={`settings-${section.id}`} noValidate>
      <input type="hidden" name="section" value={section.id} />
      {section.fields.map((field) => {
        const name = fieldName(section, field);
        const error = errors[name];
        const hint = field.hint && !error && <p className="mt-1.5 text-sm text-muted">{field.hint}</p>;
        const problem = error && (
          <p className="mt-1.5 text-sm text-accent" data-testid={`error-${name}`}>
            {error}
          </p>
        );

        if (field.kind === "toggle") {
          const checked = typed ? typed[name] === "on" : saved[name] === true;
          return (
            <div key={name}>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" name={name} defaultChecked={checked} className="mt-0.5 size-5 accent-accent" />
                <span className="font-medium">{field.label}</span>
              </label>
              {hint}
            </div>
          );
        }

        const value = typed ? (typed[name] ?? "") : String(saved[name] ?? "");
        const common = { id: name, name, defaultValue: value, className: `mt-1.5 ${inputClass}`, "aria-invalid": error ? true : undefined };
        return (
          <div key={name}>
            <label htmlFor={name} className={labelClass}>
              {field.label}
            </label>
            {field.kind === "textarea" ? (
              <textarea {...common} rows={3} maxLength={field.maxLength} />
            ) : field.kind === "select" ? (
              <select {...common}>
                {field.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                {...common}
                type={field.kind === "number" ? "number" : field.kind === "email" ? "email" : field.kind === "whatsapp" ? "tel" : "text"}
                inputMode={field.kind === "url" ? "url" : undefined}
                min={field.min}
                max={field.max}
                maxLength={field.kind === "number" ? undefined : (field.maxLength ?? 40)}
              />
            )}
            {hint}
            {problem}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Saving…" : "Save"}
        </button>
        <p role="status" aria-live="polite" className="text-sm" data-testid={`settings-message-${section.id}`}>
          {state.error && <span className="text-accent">{state.error}</span>}
          {state.success && <span className="text-whatsapp-dark">{state.success}</span>}
        </p>
      </div>
    </form>
  );
}
