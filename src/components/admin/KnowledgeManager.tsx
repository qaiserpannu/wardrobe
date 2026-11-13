"use client";

import { useActionState, useState, useTransition } from "react";
import {
  deleteKnowledgeAction,
  type KnowledgeState,
  saveKnowledgeAction,
  setKnowledgeActiveAction,
} from "@/app/admin/(portal)/assistant/actions";
import { inputClass, labelClass, primaryButtonClass } from "./fields";

type Item = { id: string; kind: "faq" | "policy"; title: string; content: string; isActive: boolean };

const initial: KnowledgeState = {};
const small = "inline-flex min-h-9 items-center justify-center rounded-md border border-line bg-white px-3 text-sm hover:border-accent hover:text-accent disabled:opacity-40";
const KIND_LABELS = { policy: "Policy", faq: "Common question" } as const;

function EntryForm({ item, onDone }: { item?: Item; onDone?: () => void }) {
  const [state, action, pending] = useActionState(async (previous: KnowledgeState, formData: FormData) => {
    const result = await saveKnowledgeAction(previous, formData);
    if (!result.error) onDone?.();
    return result;
  }, initial);
  const values = state.values ?? { kind: item?.kind ?? "policy", title: item?.title ?? "", content: item?.content ?? "" };
  const prefix = item?.id ?? "new";

  return (
    <form action={action} key={state.error ? JSON.stringify(state.values) : (state.success ?? "form")} className="space-y-4" data-testid={item ? "knowledge-edit" : "knowledge-add"}>
      {item && <input type="hidden" name="id" value={item.id} />}
      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <div>
          <label htmlFor={`${prefix}-kind`} className={labelClass}>
            Type
          </label>
          <select id={`${prefix}-kind`} name="kind" defaultValue={values.kind} className={`mt-1.5 ${inputClass}`}>
            <option value="policy">{KIND_LABELS.policy}</option>
            <option value="faq">{KIND_LABELS.faq}</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${prefix}-title`} className={labelClass}>
            Title
          </label>
          <input id={`${prefix}-title`} name="title" required maxLength={100} defaultValue={values.title} placeholder="For example: Pickup" className={`mt-1.5 ${inputClass}`} />
        </div>
      </div>
      <div>
        <label htmlFor={`${prefix}-content`} className={labelClass}>
          What the assistant may say
        </label>
        <textarea id={`${prefix}-content`} name="content" required rows={3} maxLength={2000} defaultValue={values.content} className={`mt-1.5 ${inputClass}`} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Saving…" : item ? "Save" : "Add"}
        </button>
        {onDone && (
          <button type="button" className={small} onClick={onDone}>
            Cancel
          </button>
        )}
        <p role="status" aria-live="polite" className="text-sm" data-testid="knowledge-message">
          {state.error ? <span className="text-accent">{state.error}</span> : state.success ? <span className="text-whatsapp-dark">{state.success}</span> : null}
        </p>
      </div>
    </form>
  );
}

/** The approved facts the assistant may quote: add, edit, switch off, delete. */
export function KnowledgeManager({ items }: { items: Item[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (task: () => Promise<KnowledgeState>) =>
    startTransition(async () => {
      const result = await task();
      setError(result.error ?? null);
    });

  return (
    <div data-testid="knowledge-manager">
      {error && (
        <p role="alert" className="mb-3 text-sm text-accent">
          {error}
        </p>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-muted">Nothing yet. Until you add some, the assistant passes every question about the shop to you.</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <li key={item.id} className="py-4" data-testid="knowledge-item" data-title={item.title}>
              {editing === item.id ? (
                <EntryForm item={item} onDone={() => setEditing(null)} />
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                    <p className={`font-medium ${item.isActive ? "" : "text-muted line-through"}`}>
                      {item.title}{" "}
                      <span className="text-xs font-normal text-muted no-underline">
                        {KIND_LABELS[item.kind]}
                        {item.isActive ? "" : " · switched off"}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" className={small} disabled={busy} onClick={() => setEditing(item.id)} aria-label={`Edit ${item.title}`}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className={small}
                        disabled={busy}
                        onClick={() => run(() => setKnowledgeActiveAction(item.id, !item.isActive))}
                        aria-label={`${item.isActive ? "Switch off" : "Switch on"} ${item.title}`}
                      >
                        {item.isActive ? "Switch off" : "Switch on"}
                      </button>
                      <button
                        type="button"
                        className={small}
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm(`Delete “${item.title}”? The assistant will no longer be able to answer this.`)) run(() => deleteKnowledgeAction(item.id));
                        }}
                        aria-label={`Delete ${item.title}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className={`mt-1.5 text-sm break-words whitespace-pre-line ${item.isActive ? "" : "text-muted"}`}>{item.content}</p>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5 border-t border-line pt-5">
        <h3 className="mb-3 font-medium">Add information</h3>
        <EntryForm />
      </div>
    </div>
  );
}
