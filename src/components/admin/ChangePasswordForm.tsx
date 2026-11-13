"use client";

import { useActionState } from "react";
import { changePasswordAction, type FormState } from "@/app/admin/actions";
import { inputClass, labelClass, primaryButtonClass } from "./fields";

const initial: FormState = {};

const FIELDS = [
  { name: "current", label: "Current password", autoComplete: "current-password" },
  { name: "next", label: "New password", autoComplete: "new-password", hint: "At least 12 characters. A few unrelated words work well." },
  { name: "confirm", label: "New password again", autoComplete: "new-password" },
] as const;

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, initial);
  return (
    // The key clears the boxes after a successful change.
    <form action={action} key={state.success} className="max-w-md space-y-5" data-testid="password-form">
      {FIELDS.map((field) => (
        <div key={field.name}>
          <label htmlFor={field.name} className={labelClass}>
            {field.label}
          </label>
          <input
            id={field.name}
            name={field.name}
            type="password"
            autoComplete={field.autoComplete}
            required
            maxLength={200}
            className={`mt-1.5 ${inputClass}`}
          />
          {"hint" in field && <p className="mt-1.5 text-sm text-muted">{field.hint}</p>}
        </div>
      ))}
      <p role="alert" aria-live="polite" className="min-h-5 text-sm" data-testid="password-message">
        {state.error && <span className="text-accent">{state.error}</span>}
        {state.success && <span className="text-whatsapp-dark">{state.success}</span>}
      </p>
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
