"use client";

import { useActionState, useState } from "react";
import { type ActionState, changeStatusAction, updateHoldAction } from "@/app/admin/(portal)/products/actions";
import { type ProductStatus, STATUS_TRANSITIONS } from "@/lib/product-form";
import { inputClass, labelClass, primaryButtonClass } from "./fields";

type Hold = { customerName: string; customerContact: string | null; note: string | null; heldAt: string; expiresAt: string | null; endsIn: string | null };

type Props = {
  productId: string;
  status: ProductStatus;
  hasPhotos: boolean;
  hold: Hold | null;
  /** The shop's usual hold length, in hours. */
  defaultHoldHours: number;
};

const initial: ActionState = {};
const outlineButton =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-accent px-5 text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-accent";

const HOLD_LENGTHS = [
  { hours: 24, label: "1 day" },
  { hours: 48, label: "2 days" },
  { hours: 72, label: "3 days" },
  { hours: 120, label: "5 days" },
  { hours: 168, label: "7 days" },
];

/** What each allowed move is called on its button. */
function actionLabel(from: ProductStatus, to: ProductStatus): string {
  if (to === "available") return from === "draft" ? "Publish to the website" : from === "pending" ? "End hold (make available)" : "Undo sale (make available)";
  if (to === "sold") return "Mark as sold";
  if (to === "archived") return "Archive (remove from website)";
  if (to === "draft") return "Restore as a draft";
  return "Put on hold";
}

const EXPLANATION: Record<ProductStatus, string> = {
  draft: "Only you can see this item. Publish it when it is ready.",
  available: "On the website and offered to customers.",
  pending: "On the website with an ON HOLD badge. Customers cannot ask to buy it.",
  sold: "On the website with a SOLD badge.",
  archived: "Hidden from the website. Nothing is deleted; you can restore it.",
};

function HoldFields({ hold, defaultHoldHours, extending }: { hold: Hold | null; defaultHoldHours: number; extending: boolean }) {
  const lengths = HOLD_LENGTHS;
  const usual = defaultHoldHours % 24 === 0 ? `${defaultHoldHours / 24} ${defaultHoldHours === 24 ? "day" : "days"}` : `${defaultHoldHours} hours`;
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="customerName" className={labelClass}>
          Held for
        </label>
        <input id="customerName" name="customerName" required maxLength={120} defaultValue={hold?.customerName ?? ""} className={`mt-1.5 ${inputClass}`} />
      </div>
      <div>
        <label htmlFor="customerContact" className={labelClass}>
          Phone or other contact (optional)
        </label>
        <input id="customerContact" name="customerContact" maxLength={120} defaultValue={hold?.customerContact ?? ""} className={`mt-1.5 ${inputClass}`} />
      </div>
      <div>
        <label htmlFor="note" className={labelClass}>
          Private note (optional)
        </label>
        <textarea id="note" name="note" rows={2} maxLength={1000} defaultValue={hold?.note ?? ""} className={`mt-1.5 ${inputClass}`} />
      </div>
      <div>
        <label htmlFor="holdHours" className={labelClass}>
          {extending ? "Change when the hold ends" : "Hold for"}
        </label>
        <select id="holdHours" name="holdHours" defaultValue="" className={`mt-1.5 ${inputClass}`}>
          <option value="">{extending ? "Keep the current end time" : `The usual ${usual}`}</option>
          {lengths.map((l) => (
            <option key={l.hours} value={l.hours}>
              {l.label} from now
            </option>
          ))}
        </select>
      </div>
      <p className="text-sm text-muted">Only you can see these details. Customers and the chat assistant only see “on hold”.</p>
    </div>
  );
}

export function StatusPanel({ productId, status, hasPhotos, hold, defaultHoldHours }: Props) {
  const [state, action, pending] = useActionState(changeStatusAction, initial);
  const [holdState, holdAction, holdPending] = useActionState(updateHoldAction, initial);
  const [holdFormOpen, setHoldFormOpen] = useState(false);
  const moves = STATUS_TRANSITIONS[status];

  return (
    <div data-testid="status-panel" data-status={status}>
      <p className="text-sm text-muted">{EXPLANATION[status]}</p>

      {status === "pending" && hold && (
        <div className="mt-4 rounded-lg border border-gold/60 bg-sand p-4 text-sm" data-testid="hold-details">
          <p>
            Held for <strong>{hold.customerName}</strong>
            {hold.customerContact ? ` (${hold.customerContact})` : ""}
          </p>
          <p className="mt-1 text-muted">Since {hold.heldAt}</p>
          <p className="mt-1" data-testid="hold-expiry">
            {hold.expiresAt ? `Ends ${hold.expiresAt} (${hold.endsIn}), then the item becomes available again.` : "No end time: it stays on hold until you change it."}
          </p>
          {hold.note && <p className="mt-2 whitespace-pre-line">{hold.note}</p>}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {moves
          .filter((to) => to !== "pending")
          .map((to) => (
            <form
              key={to}
              action={action}
              onSubmit={(event) => {
                if (to === "archived" && !window.confirm("Archive this item? It will disappear from the website. You can restore it later.")) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="id" value={productId} />
              <input type="hidden" name="to" value={to} />
              <button
                type="submit"
                disabled={pending || (status === "draft" && to === "available" && !hasPhotos)}
                className={to === "archived" ? outlineButton : primaryButtonClass}
                data-testid={`status-${to}`}
              >
                {actionLabel(status, to)}
              </button>
            </form>
          ))}
        {moves.includes("pending") && !holdFormOpen && (
          <button type="button" className={outlineButton} onClick={() => setHoldFormOpen(true)} data-testid="open-hold-form">
            Put on hold…
          </button>
        )}
        {status === "pending" && !holdFormOpen && (
          <button type="button" className={outlineButton} onClick={() => setHoldFormOpen(true)} data-testid="open-hold-form">
            Edit or extend hold…
          </button>
        )}
      </div>
      {status === "draft" && !hasPhotos && <p className="mt-2 text-sm text-muted">Add at least one photo to publish.</p>}

      {holdFormOpen && status !== "pending" && (
        <form action={action} className="mt-5 rounded-lg border border-line bg-white p-4" data-testid="hold-form">
          <input type="hidden" name="id" value={productId} />
          <input type="hidden" name="to" value="pending" />
          <HoldFields hold={null} defaultHoldHours={defaultHoldHours} extending={false} />
          <div className="mt-4 flex gap-3">
            <button type="submit" disabled={pending} className={primaryButtonClass}>
              Put on hold
            </button>
            <button type="button" className={outlineButton} onClick={() => setHoldFormOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {holdFormOpen && status === "pending" && (
        <form action={holdAction} className="mt-5 rounded-lg border border-line bg-white p-4" data-testid="hold-form">
          <input type="hidden" name="id" value={productId} />
          <HoldFields hold={hold} defaultHoldHours={defaultHoldHours} extending />
          <div className="mt-4 flex gap-3">
            <button type="submit" disabled={holdPending} className={primaryButtonClass}>
              Save hold
            </button>
            <button type="button" className={outlineButton} onClick={() => setHoldFormOpen(false)}>
              Close
            </button>
          </div>
        </form>
      )}

      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm" data-testid="status-message">
        {(state.error || holdState.error) && <span className="text-accent">{state.error ?? holdState.error}</span>}
        {!state.error && !holdState.error && (state.success || holdState.success) && (
          <span className="text-whatsapp-dark">{holdState.success ?? state.success}</span>
        )}
      </p>
    </div>
  );
}
