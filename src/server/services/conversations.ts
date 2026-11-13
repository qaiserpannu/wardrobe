import "server-only";
import { and, asc, desc, eq, gte, ne, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import {
  conversations,
  customers,
  escalations,
  leads,
  messages,
  notifications,
  products,
} from "@/server/db/schema";

/**
 * Conversation records for the AI sales agent: who is talking, what was said,
 * buying interest, questions passed to the owner and what the owner was told.
 * Nothing here can change inventory or settings.
 */

export type Channel = "web" | "whatsapp";
export type Sender = "customer" | "agent" | "owner" | "system";
export type ConversationState = "agent" | "waiting_for_owner" | "owner" | "closed";
export type LeadStage = "inquiry" | "purchase_request" | "reservation_request" | "completed";
export type EscalationReason = "cannot_answer" | "human_requested" | "purchase_request";

export type StoredMessage = { id: string; sender: Sender; body: string; productCodes: string[]; createdAt: Date };

/** A conversation left idle this long is finished; the next message starts a new one (history is kept). */
const CONVERSATION_IDLE_DAYS = 30;

export async function getOrCreateCustomer(channel: Channel, identity: string) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.channel, channel), eq(customers.channelIdentity, identity)))
    .limit(1);
  if (existing) return existing;
  const [created] = await db.insert(customers).values({ channel, channelIdentity: identity }).returning();
  return created;
}

export async function findCustomer(channel: Channel, identity: string) {
  const [existing] = await getDb()
    .select()
    .from(customers)
    .where(and(eq(customers.channel, channel), eq(customers.channelIdentity, identity)))
    .limit(1);
  return existing ?? null;
}

/** Remember a name or contact detail the customer chose to give. Never overwrites with blanks. */
export async function updateCustomerDetails(customerId: string, details: { name?: string; contact?: string }) {
  const set: { name?: string; contact?: string } = {};
  if (details.name?.trim()) set.name = details.name.trim().slice(0, 120);
  if (details.contact?.trim()) set.contact = details.contact.trim().slice(0, 120);
  if (Object.keys(set).length) await getDb().update(customers).set(set).where(eq(customers.id, customerId));
}

export async function findOpenConversation(customerId: string) {
  const cutoff = new Date(Date.now() - CONVERSATION_IDLE_DAYS * 24 * 60 * 60 * 1000);
  const [open] = await getDb()
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.customerId, customerId),
        ne(conversations.state, "closed"),
        gte(conversations.lastMessageAt, cutoff),
      ),
    )
    .orderBy(desc(conversations.lastMessageAt))
    .limit(1);
  return open ?? null;
}

export async function getOrCreateConversation(customerId: string, channel: Channel) {
  const open = await findOpenConversation(customerId);
  if (open) return open;
  const [created] = await getDb().insert(conversations).values({ customerId, channel }).returning();
  return created;
}

export async function getConversationState(conversationId: string): Promise<ConversationState | null> {
  const [row] = await getDb().select({ state: conversations.state }).from(conversations).where(eq(conversations.id, conversationId));
  return row?.state ?? null;
}

/** When the owner last wrote in this conversation, or null if never. */
export async function lastOwnerMessageAt(conversationId: string): Promise<Date | null> {
  const [row] = await getDb()
    .select({ at: messages.createdAt })
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.sender, "owner")))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  return row?.at ?? null;
}

export async function setConversationState(conversationId: string, state: ConversationState) {
  await getDb().update(conversations).set({ state }).where(eq(conversations.id, conversationId));
}

export async function addMessage(
  conversationId: string,
  sender: Sender,
  body: string,
  productCodes: string[] = [],
): Promise<StoredMessage> {
  const db = getDb();
  const [row] = await db.insert(messages).values({ conversationId, sender, body, productCodes }).returning();
  await db.update(conversations).set({ lastMessageAt: row.createdAt }).where(eq(conversations.id, conversationId));
  return { id: row.id, sender: row.sender, body: row.body, productCodes: row.productCodes, createdAt: row.createdAt };
}

/** The most recent messages, oldest first. */
export async function listMessages(conversationId: string, limit = 40): Promise<StoredMessage[]> {
  const rows = await getDb()
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(limit);
  return rows
    .reverse()
    .map((r) => ({ id: r.id, sender: r.sender, body: r.body, productCodes: r.productCodes, createdAt: r.createdAt }));
}

/** How many messages this customer sent since a point in time (for rate limits). */
export async function countCustomerMessagesSince(customerId: string, since: Date): Promise<number> {
  const [{ n }] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(and(eq(conversations.customerId, customerId), eq(messages.sender, "customer"), gte(messages.createdAt, since)));
  return n;
}

/** How many customer messages the whole site received since a point in time (for the daily cost cap). */
export async function countAllCustomerMessagesSince(since: Date): Promise<number> {
  const [{ n }] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .where(and(eq(messages.sender, "customer"), gte(messages.createdAt, since)));
  return n;
}

/** Record buying interest in one product. Repeats for the same product update the existing record. */
export async function recordLead(input: {
  conversationId: string;
  productCode: string;
  stage: LeadStage;
  summary: string;
  customerRequest: string;
}) {
  const db = getDb();
  const [product] = await db.select({ id: products.id }).from(products).where(eq(products.code, input.productCode)).limit(1);
  if (!product) return null;
  const [existing] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.conversationId, input.conversationId), eq(leads.productId, product.id)))
    .limit(1);
  const values = { stage: input.stage, summary: input.summary, customerRequest: input.customerRequest };
  if (existing) {
    // "completed" is set only by the owner and is never overwritten from a conversation.
    if (existing.stage === "completed") return existing;
    const [updated] = await db.update(leads).set(values).where(eq(leads.id, existing.id)).returning();
    return updated;
  }
  const [created] = await db
    .insert(leads)
    .values({ conversationId: input.conversationId, productId: product.id, ...values })
    .returning();
  return created;
}

export async function createEscalation(input: { conversationId: string; reason: EscalationReason; question: string }) {
  const [created] = await getDb().insert(escalations).values(input).returning();
  return created;
}

export async function listOpenEscalations(conversationId: string) {
  return getDb()
    .select({ reason: escalations.reason, question: escalations.question, createdAt: escalations.createdAt })
    .from(escalations)
    .where(and(eq(escalations.conversationId, conversationId), sql`${escalations.resolvedAt} is null`))
    .orderBy(asc(escalations.createdAt));
}

/**
 * Store a notification for the owner. Returns null if the same event was
 * already recorded, so the owner is never told twice.
 */
export async function recordNotification(input: {
  conversationId: string;
  kind: EscalationReason;
  dedupeKey: string;
  subject: string;
  body: string;
  route: string;
}) {
  const [created] = await getDb().insert(notifications).values(input).onConflictDoNothing().returning();
  return created ?? null;
}

export async function markNotification(id: string, result: { delivered: boolean; error?: string }) {
  await getDb()
    .update(notifications)
    .set({ delivered: result.delivered, error: result.error ?? null })
    .where(eq(notifications.id, id));
}
