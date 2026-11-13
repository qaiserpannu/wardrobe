import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { conversations, customers, escalations, leads, messages, products } from "@/server/db/schema";
import type { AdminUser } from "./admin-auth";
import { AdminActionError } from "./admin-products";
import { recordAudit } from "./audit";
import type { Channel, ConversationState, EscalationReason, LeadStage, Sender } from "./conversations";

/**
 * ADMIN ONLY: the owner's view of customer conversations, and the owner's
 * part in them (replying in person, handing back to the assistant, marking
 * requests as dealt with). Callers must have checked requireAdmin().
 */

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const INBOX_PAGE_SIZE = 25;
export const OWNER_MESSAGE_MAX = 2000;

export type InboxFilter = "waiting" | "all";

export type InboxItem = {
  id: string;
  customerName: string | null;
  customerContact: string | null;
  channel: Channel;
  state: ConversationState;
  lastMessageAt: Date;
  lastMessage: { sender: Sender; body: string } | null;
  /** Requests still waiting for the owner. */
  waiting: { reason: EscalationReason; question: string }[];
};

export type InboxConversation = {
  id: string;
  channel: Channel;
  state: ConversationState;
  startedAt: Date;
  customer: { name: string | null; contact: string | null };
  messages: { id: string; sender: Sender; body: string; productCodes: string[]; createdAt: Date }[];
  requests: { id: string; reason: EscalationReason; question: string; createdAt: Date; resolvedAt: Date | null }[];
  interest: { id: string; stage: LeadStage; summary: string; productId: string; productCode: string; productName: string; productStatus: string }[];
};

const waitingExists = sql`exists (select 1 from ${escalations} where ${escalations.conversationId} = ${conversations.id} and ${escalations.resolvedAt} is null)`;
const hasMessages = sql`exists (select 1 from ${messages} where ${messages.conversationId} = ${conversations.id})`;

export async function listInbox(filter: InboxFilter, pageInput = 1): Promise<{ items: InboxItem[]; total: number; page: number; pageCount: number }> {
  const db = getDb();
  const where = filter === "waiting" ? and(hasMessages, waitingExists) : hasMessages;
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(conversations).where(where);
  const pageCount = Math.max(1, Math.ceil(total / INBOX_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(pageInput) || 1), pageCount);

  const rows = await db
    .select({
      id: conversations.id,
      channel: conversations.channel,
      state: conversations.state,
      lastMessageAt: conversations.lastMessageAt,
      customerName: customers.name,
      customerContact: customers.contact,
    })
    .from(conversations)
    .innerJoin(customers, eq(conversations.customerId, customers.id))
    .where(where)
    .orderBy(desc(conversations.lastMessageAt))
    .limit(INBOX_PAGE_SIZE)
    .offset((page - 1) * INBOX_PAGE_SIZE);
  if (rows.length === 0) return { items: [], total, page, pageCount };

  const ids = rows.map((r) => r.id);
  const [latest, open] = await Promise.all([
    db
      .selectDistinctOn([messages.conversationId], { conversationId: messages.conversationId, sender: messages.sender, body: messages.body })
      .from(messages)
      .where(and(inArray(messages.conversationId, ids), sql`${messages.sender} <> 'system'`))
      .orderBy(messages.conversationId, desc(messages.createdAt)),
    db
      .select({ conversationId: escalations.conversationId, reason: escalations.reason, question: escalations.question })
      .from(escalations)
      .where(and(inArray(escalations.conversationId, ids), isNull(escalations.resolvedAt)))
      .orderBy(asc(escalations.createdAt)),
  ]);

  return {
    items: rows.map((r) => {
      const last = latest.find((m) => m.conversationId === r.id);
      return {
        ...r,
        lastMessage: last ? { sender: last.sender, body: last.body.slice(0, 200) } : null,
        waiting: open.filter((e) => e.conversationId === r.id).map(({ reason, question }) => ({ reason, question })),
      };
    }),
    total,
    page,
    pageCount,
  };
}

/** How many conversations have a request waiting for the owner. */
export async function countWaitingConversations(): Promise<number> {
  const [row] = await getDb().select({ n: sql<number>`count(*)::int` }).from(conversations).where(waitingExists);
  return row?.n ?? 0;
}

export async function getInboxConversation(id: string): Promise<InboxConversation | null> {
  if (!ID_PATTERN.test(id)) return null;
  const db = getDb();
  const [row] = await db
    .select({ conversation: conversations, name: customers.name, contact: customers.contact })
    .from(conversations)
    .innerJoin(customers, eq(conversations.customerId, customers.id))
    .where(eq(conversations.id, id));
  if (!row) return null;

  const [thread, requests, interest] = await Promise.all([
    db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt), asc(messages.id)).limit(500),
    db.select().from(escalations).where(eq(escalations.conversationId, id)).orderBy(asc(escalations.createdAt)),
    db
      .select({
        id: leads.id,
        stage: leads.stage,
        summary: leads.summary,
        productId: products.id,
        productCode: products.code,
        productName: products.name,
        productStatus: products.status,
      })
      .from(leads)
      .innerJoin(products, eq(leads.productId, products.id))
      .where(eq(leads.conversationId, id))
      .orderBy(asc(leads.createdAt)),
  ]);

  return {
    id,
    channel: row.conversation.channel,
    state: row.conversation.state,
    startedAt: row.conversation.createdAt,
    customer: { name: row.name, contact: row.contact },
    messages: thread.map((m) => ({ id: m.id, sender: m.sender, body: m.body, productCodes: m.productCodes, createdAt: m.createdAt })),
    requests: requests.map((e) => ({ id: e.id, reason: e.reason, question: e.question, createdAt: e.createdAt, resolvedAt: e.resolvedAt })),
    interest,
  };
}

async function existing(id: string) {
  const [row] = ID_PATTERN.test(id) ? await getDb().select().from(conversations).where(eq(conversations.id, id)) : [];
  if (!row) throw new AdminActionError("This conversation no longer exists.");
  return row;
}

async function resolveOpenRequests(conversationId: string, answer: string | null): Promise<number> {
  const resolved = await getDb()
    .update(escalations)
    .set({ resolvedAt: new Date(), ownerAnswer: answer })
    .where(and(eq(escalations.conversationId, conversationId), isNull(escalations.resolvedAt)))
    .returning({ id: escalations.id });
  return resolved.length;
}

/**
 * The owner writes to the customer in person. The assistant then stays out of
 * the conversation until it is handed back, and any waiting requests count as
 * dealt with.
 */
export async function replyAsOwner(admin: AdminUser, conversationId: string, text: string): Promise<void> {
  const conversation = await existing(conversationId);
  const body = text.trim();
  if (!body) throw new AdminActionError("Write a message first.");
  if (body.length > OWNER_MESSAGE_MAX) throw new AdminActionError(`Keep the message under ${OWNER_MESSAGE_MAX} characters.`);
  if (conversation.channel !== "web") {
    // WhatsApp delivery (and its 24-hour rule) arrives with Milestone 6.
    throw new AdminActionError("Replying from here works for website chats only for now. Please reply in WhatsApp.");
  }
  const db = getDb();
  const now = new Date();
  await db.insert(messages).values({ conversationId, sender: "owner", body, createdAt: now });
  await db.update(conversations).set({ state: "owner", lastMessageAt: now }).where(eq(conversations.id, conversationId));
  await resolveOpenRequests(conversationId, body);
  // What was said stays in the conversation; the audit line records only that it happened.
  await recordAudit({ adminUserId: admin.id, action: "inbox.reply", entityType: "conversation", entityId: conversationId, summary: `${admin.name} replied to a customer` });
}

/** Let the assistant answer this customer again. */
export async function handBackToAssistant(admin: AdminUser, conversationId: string): Promise<void> {
  const conversation = await existing(conversationId);
  if (conversation.state === "agent") return;
  await getDb().update(conversations).set({ state: "agent" }).where(eq(conversations.id, conversationId));
  await recordAudit({ adminUserId: admin.id, action: "inbox.hand_back", entityType: "conversation", entityId: conversationId, summary: "Conversation handed back to the assistant" });
}

/** The owner handled it elsewhere (WhatsApp, in person): clear the waiting requests without sending a message. */
export async function markDealtWith(admin: AdminUser, conversationId: string): Promise<void> {
  const conversation = await existing(conversationId);
  const count = await resolveOpenRequests(conversationId, null);
  if (conversation.state === "waiting_for_owner") {
    await getDb().update(conversations).set({ state: "agent" }).where(eq(conversations.id, conversationId));
  }
  if (count > 0) {
    await recordAudit({ adminUserId: admin.id, action: "inbox.dealt_with", entityType: "conversation", entityId: conversationId, summary: `${count} customer ${count === 1 ? "request" : "requests"} marked as dealt with` });
  }
}

/** Customer messages received across the site in the last 24 hours (what the daily limit counts). */
export async function countCustomerMessagesLastDay(): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .where(sql`${messages.sender} = 'customer' and ${messages.createdAt} > now() - interval '24 hours'`);
  return row?.n ?? 0;
}
