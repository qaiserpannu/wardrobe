import "server-only";
import {
  addMessage,
  countAllCustomerMessagesSince,
  countCustomerMessagesSince,
  findCustomer,
  findOpenConversation,
  getConversationState,
  getOrCreateConversation,
  getOrCreateCustomer,
  lastOwnerMessageAt,
  listMessages,
  setConversationState,
  type Channel,
  type StoredMessage,
} from "@/server/services/conversations";
import { listActiveKnowledge } from "@/server/services/knowledge";
import { getProductByCode } from "@/server/services/products";
import { getSettings } from "@/server/services/settings";
import type { PublicProduct } from "@/server/services/types";
import { buildSystemPrompt } from "./prompt";
import { getAgentModel } from "./providers";
import { AGENT_TOOLS, runAgentTool, type ToolContext } from "./tools";
import type { AgentModel, HistoryMessage } from "./types";

/**
 * The agent core: one customer message in, one reply out. It knows nothing
 * about the channel; the website chat and (later) WhatsApp both call this.
 */

export const MAX_MESSAGE_LENGTH = 1000;
const PER_MINUTE = 8;
const PER_DAY = 120;
const HISTORY_MESSAGES = 30;
const MAX_CARDS = 4;
/** If the owner took over a chat and then went quiet this long, the assistant answers again. */
export const OWNER_QUIET_HOURS = 24;

export const SAFE_REPLIES = {
  unavailable:
    "Sorry, I'm having trouble answering right now. Please try again in a moment, or message us on WhatsApp using the button below.",
  unverified:
    "Let me double-check that before I say anything wrong. Could you tell me again what you're looking for, or ask about a specific item?",
  tooFast: "You're sending messages faster than I can keep up. Please wait a moment and try again.",
  ownerHandling:
    "Thank you. The owner has your message and will reply here. You can also reach us on WhatsApp using the button below.",
  dailyLimit:
    "The assistant has reached its limit for today. Please message us on WhatsApp using the button below and we'll reply ourselves.",
} as const;

export type AgentReply = {
  reply: string;
  /** Cards for the products mentioned, read fresh from inventory. */
  products: PublicProduct[];
  /** True when the customer asked for a person; the channel should make the human route obvious. */
  handoff: boolean;
  /** Why no AI answer was produced, if that is the case. */
  limited?: "rate" | "daily" | "error" | "owner";
  /** True while the customer is waiting for the owner, so the channel can watch for the owner's reply. */
  awaitingOwner: boolean;
};

export type IncomingMessage = {
  channel: Channel;
  /** Who is talking, as the channel knows them: anonymous browser ID or phone number. */
  identity: string;
  text: string;
  /** Website only: the product page the visitor is on. Checked against inventory before use. */
  viewingProductCode?: string;
};

const CODE_PATTERN = /PLW-\d{1,9}/gi;

export function extractProductCodes(text: string): string[] {
  return [...new Set((text.match(CODE_PATTERN) ?? []).map((c) => c.toUpperCase()))];
}

function toHistory(stored: StoredMessage[]): HistoryMessage[] {
  const history: HistoryMessage[] = [];
  for (const m of stored) {
    if (m.sender === "system") continue;
    history.push({ role: m.sender === "customer" ? "user" : "assistant", text: m.body });
  }
  // The provider needs the conversation to open with the customer.
  while (history.length && history[0].role !== "user") history.shift();
  return history;
}

/**
 * Check every product ID in a reply against the inventory. A reply naming an
 * item that does not exist is never shown to the customer.
 */
export async function verifyReply(text: string): Promise<{ ok: boolean; products: PublicProduct[] }> {
  const products: PublicProduct[] = [];
  for (const code of extractProductCodes(text)) {
    const product = await getProductByCode(code);
    if (!product) return { ok: false, products: [] };
    products.push(product);
  }
  return { ok: true, products: products.slice(0, MAX_CARDS) };
}

/** Product cards for stored messages, always from current inventory (an item sold since shows as sold). */
export async function loadCards(codes: string[]): Promise<PublicProduct[]> {
  const found = await Promise.all(codes.slice(0, MAX_CARDS).map((c) => getProductByCode(c)));
  return found.filter((p): p is PublicProduct => p !== null);
}

export async function handleMessage(incoming: IncomingMessage, model?: AgentModel): Promise<AgentReply> {
  const text = incoming.text.trim().slice(0, MAX_MESSAGE_LENGTH);
  const customer = await getOrCreateCustomer(incoming.channel, incoming.identity);
  const settings = await getSettings();

  // Limits come first so a flood cannot run up AI costs.
  const now = Date.now();
  if ((await countCustomerMessagesSince(customer.id, new Date(now - 60_000))) >= PER_MINUTE) {
    return { reply: SAFE_REPLIES.tooFast, products: [], handoff: false, limited: "rate", awaitingOwner: false };
  }
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
  if (
    (await countCustomerMessagesSince(customer.id, dayAgo)) >= PER_DAY ||
    (await countAllCustomerMessagesSince(dayAgo)) >= settings.ai_assistant.dailyMessageLimit
  ) {
    return { reply: SAFE_REPLIES.dailyLimit, products: [], handoff: true, limited: "daily", awaitingOwner: false };
  }

  const conversation = await getOrCreateConversation(customer.id, incoming.channel);
  await addMessage(conversation.id, "customer", text);

  // The owner has taken this conversation over: the assistant stays out of it
  // (no model call), unless the owner has since gone quiet for a long time.
  if (conversation.state === "owner") {
    const lastOwner = await lastOwnerMessageAt(conversation.id);
    if (lastOwner && now - lastOwner.getTime() < OWNER_QUIET_HOURS * 60 * 60 * 1000) {
      await addMessage(conversation.id, "system", SAFE_REPLIES.ownerHandling);
      return { reply: SAFE_REPLIES.ownerHandling, products: [], handoff: true, limited: "owner", awaitingOwner: true };
    }
    await setConversationState(conversation.id, "agent");
  }

  const history = toHistory(await listMessages(conversation.id, HISTORY_MESSAGES));
  const viewing = incoming.viewingProductCode ? await getProductByCode(incoming.viewingProductCode) : null;
  // Notes for this turn only; they are not stored as something the customer said.
  const notes: string[] = [];
  if (customer.name) notes.push(`the customer's name on record is ${customer.name}`);
  if (viewing) notes.push(`they are currently on the page of product ${viewing.code}`);
  if (notes.length && history.length) {
    const last = history[history.length - 1];
    history[history.length - 1] = {
      ...last,
      text: `${last.text}\n\n[Context from the shop's system, not written by the customer: ${notes.join("; ")}.]`,
    };
  }

  const ctx: ToolContext = {
    conversationId: conversation.id,
    customerId: customer.id,
    channel: incoming.channel,
    settings,
    handoffRequested: false,
  };

  let reply: string;
  let products: PublicProduct[] = [];
  let limited: AgentReply["limited"];
  try {
    const result = await (model ?? getAgentModel()).runTurn({
      system: buildSystemPrompt(settings, await listActiveKnowledge(), incoming.channel),
      history,
      tools: AGENT_TOOLS,
      runTool: (name, input) => runAgentTool(ctx, name, input),
    });
    if (result.outcome !== "ok" || !result.text) {
      reply = SAFE_REPLIES.unavailable;
      limited = "error";
    } else {
      const checked = await verifyReply(result.text);
      reply = checked.ok ? result.text : SAFE_REPLIES.unverified;
      products = checked.products;
    }
  } catch (err) {
    console.error("[agent] turn failed:", err instanceof Error ? err.message : err);
    reply = SAFE_REPLIES.unavailable;
    limited = "error";
  }

  await addMessage(
    conversation.id,
    limited ? "system" : "agent",
    reply,
    products.map((p) => p.code),
  );
  const state = await getConversationState(conversation.id);
  return {
    reply,
    products,
    handoff: ctx.handoffRequested || limited === "error",
    limited,
    awaitingOwner: state === "waiting_for_owner" || state === "owner",
  };
}

/** Whether this visitor's current conversation is waiting on the owner. */
export async function isAwaitingOwner(channel: Channel, identity: string): Promise<boolean> {
  const customer = await findCustomer(channel, identity);
  const conversation = customer ? await findOpenConversation(customer.id) : null;
  return conversation?.state === "waiting_for_owner" || conversation?.state === "owner";
}

/** Earlier messages for a returning customer, with cards read fresh from inventory. */
export async function loadHistory(channel: Channel, identity: string) {
  const customer = await findCustomer(channel, identity);
  if (!customer) return [];
  const conversation = await findOpenConversation(customer.id);
  if (!conversation) return [];
  const stored = (await listMessages(conversation.id, HISTORY_MESSAGES)).filter((m) => m.sender !== "system");
  return Promise.all(
    stored.map(async (m) => ({
      id: m.id,
      from: m.sender === "customer" ? ("customer" as const) : m.sender === "owner" ? ("owner" as const) : ("assistant" as const),
      text: m.body,
      products: m.productCodes.length ? await loadCards(m.productCodes) : [],
    })),
  );
}
