import "server-only";
import {
  markNotification,
  recordNotification,
  type EscalationReason,
} from "@/server/services/conversations";

/**
 * Tells the owner about one of the three events that warrant it (serious
 * buying interest, a question the agent cannot answer, a request for a human).
 * Every notification is recorded; it is emailed as well when email is set up.
 */
export type OwnerNotification = {
  conversationId: string;
  kind: EscalationReason;
  /** Same key = same event. A repeat is ignored. */
  dedupeKey: string;
  subject: string;
  body: string;
};

type EmailConfig = { apiKey: string; from: string; to: string };

function emailConfig(to: string): EmailConfig | null {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_EMAIL_FROM;
  if (!apiKey || !from || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return null;
  return { apiKey, from, to };
}

async function sendEmail(config: EmailConfig, subject: string, body: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: config.from, to: [config.to], subject, text: body }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Email service answered ${res.status}`);
}

/** Returns true if this was a new event (recorded now), false if it was a duplicate. */
export async function notifyOwner(notification: OwnerNotification, notifyEmail: string): Promise<boolean> {
  const config = emailConfig(notifyEmail);
  const row = await recordNotification({ ...notification, route: config ? "email" : "record" });
  if (!row) return false;
  if (!config) return true;
  try {
    await sendEmail(config, notification.subject, notification.body);
    await markNotification(row.id, { delivered: true });
  } catch (err) {
    // The conversation must not fail because an email could not be sent; the record stays for the inbox.
    await markNotification(row.id, { delivered: false, error: err instanceof Error ? err.message : "unknown error" });
  }
  return true;
}
