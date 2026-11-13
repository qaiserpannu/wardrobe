"use client";

import { useActionState } from "react";
import { dealtWithAction, handBackAction, type InboxState, replyAction } from "@/app/admin/(portal)/inbox/actions";
import { inputClass, labelClass, primaryButtonClass } from "./fields";

const initial: InboxState = {};
const outlineButton =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-accent px-5 text-sm font-medium text-accent transition-colors hover:bg-accent hover:text-white disabled:opacity-50";

type Props = {
  conversationId: string;
  /** Website chats can be answered from here; WhatsApp ones cannot yet. */
  canReply: boolean;
  ownerHasTakenOver: boolean;
  waitingCount: number;
  assistantName: string;
};

/** The owner's reply box and the buttons under a conversation. */
export function ConversationActions({ conversationId, canReply, ownerHasTakenOver, waitingCount, assistantName }: Props) {
  const [reply, replyFormAction, replying] = useActionState(replyAction, initial);
  const [back, backAction, handingBack] = useActionState(handBackAction, initial);
  const [dealt, dealtAction, marking] = useActionState(dealtWithAction, initial);
  const error = reply.error ?? back.error ?? dealt.error;
  const success = reply.success ?? back.success ?? dealt.success;

  return (
    <div data-testid="conversation-actions">
      {canReply ? (
        <form action={replyFormAction} key={reply.success ? "sent" : (reply.values?.message ?? "draft")} className="space-y-3" data-testid="reply-form">
          <input type="hidden" name="id" value={conversationId} />
          <label htmlFor="message" className={labelClass}>
            Reply as yourself
          </label>
          <textarea id="message" name="message" rows={3} maxLength={2000} required defaultValue={reply.values?.message ?? ""} className={inputClass} />
          <p className="text-sm text-muted">
            The customer sees this in the website chat, marked as from the shop owner, the next time they look. {assistantName} then stays quiet
            in this conversation until you hand it back (or for 24 hours after your last message).
          </p>
          <button type="submit" disabled={replying} className={primaryButtonClass}>
            {replying ? "Sending…" : "Send reply"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-muted">This is a WhatsApp conversation. Replying from here arrives with the WhatsApp milestone; for now, reply in WhatsApp.</p>
      )}

      <div className="mt-5 flex flex-wrap gap-3 border-t border-line pt-5">
        {ownerHasTakenOver && (
          <form action={backAction}>
            <input type="hidden" name="id" value={conversationId} />
            <button type="submit" disabled={handingBack} className={outlineButton} data-testid="hand-back">
              Hand back to {assistantName}
            </button>
          </form>
        )}
        {waitingCount > 0 && (
          <form action={dealtAction}>
            <input type="hidden" name="id" value={conversationId} />
            <button type="submit" disabled={marking} className={outlineButton} data-testid="dealt-with">
              Mark as dealt with (no message)
            </button>
          </form>
        )}
      </div>
      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm" data-testid="inbox-message">
        {error ? <span className="text-accent">{error}</span> : success ? <span className="text-whatsapp-dark">{success}</span> : null}
      </p>
    </div>
  );
}
