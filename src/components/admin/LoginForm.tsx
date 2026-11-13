"use client";

import { useActionState } from "react";
import { type FormState, loginAction } from "@/app/admin/actions";
import { inputClass, labelClass, primaryButtonClass } from "./fields";

const initial: FormState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);
  return (
    <form action={action} className="space-y-5" data-testid="login-form">
      <div>
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required maxLength={200} className={`mt-1.5 ${inputClass}`} />
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={200}
          className={`mt-1.5 ${inputClass}`}
        />
      </div>
      <p role="alert" aria-live="polite" className="min-h-5 text-sm text-accent" data-testid="login-error">
        {state.error}
      </p>
      <button type="submit" disabled={pending} className={`w-full ${primaryButtonClass}`}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
