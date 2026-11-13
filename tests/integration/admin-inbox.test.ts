import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { handleMessage, isAwaitingOwner, loadHistory, OWNER_QUIET_HOURS, SAFE_REPLIES } from "@/server/agent/core";
import { buildSystemPrompt } from "@/server/agent/prompt";
import type { AgentModel, TurnRequest } from "@/server/agent/types";
import { closeDb, getDb } from "@/server/db/client";
import { aiKnowledge, auditLog, conversations, customers, escalations, messages, siteSettings } from "@/server/db/schema";
import { type AdminUser, createAdmin } from "@/server/services/admin-auth";
import {
  countWaitingConversations,
  getInboxConversation,
  handBackToAssistant,
  listInbox,
  markDealtWith,
  replyAsOwner,
} from "@/server/services/admin-inbox";
import { createKnowledge, deleteKnowledge, knowledgeInputSchema, listKnowledge, setKnowledgeActive, updateKnowledge } from "@/server/services/admin-knowledge";
import { AdminActionError } from "@/server/services/admin-products";
import { saveSettingsSection } from "@/server/services/admin-settings";
import { listActiveKnowledge } from "@/server/services/knowledge";
import { getSettings } from "@/server/services/settings";

const db = getDb();
let admin: AdminUser;
let settingsBefore: { key: string; value: unknown }[];
let knowledgeBefore: (typeof aiKnowledge.$inferSelect)[];

/** A stand-in model that does what the test says, and counts how often it was asked. */
function scripted(script: (req: TurnRequest) => Promise<string>): AgentModel & { calls: TurnRequest[] } {
  const calls: TurnRequest[] = [];
  return {
    calls,
    async runTurn(req) {
      calls.push(req);
      return { text: await script(req), outcome: "ok" };
    },
  };
}
const says = (text: string) => scripted(async () => text);
const visitor = () => ({ channel: "web" as const, identity: randomUUID() });

/** A customer asks something the assistant cannot answer, so it is passed to the owner. */
async function conversationWaiting(question = "Do you deliver to Orlando?") {
  const who = visitor();
  const model = scripted(async (req) => {
    await req.runTool("save_customer_name", { name: "Sana" });
    await req.runTool("escalate_question", { question, conversation_summary: "Customer asked about delivery." });
    return "Let me check with the owner and get back to you.";
  });
  await handleMessage({ ...who, text: question }, model);
  const [row] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .innerJoin(customers, eq(conversations.customerId, customers.id))
    .where(eq(customers.channelIdentity, who.identity));
  return { who, id: row.id };
}

beforeAll(async () => {
  admin = await createAdmin({ email: `inbox-${randomUUID()}@test.invalid`, name: "Inbox Tester", password: "a-long-test-password-1" });
  settingsBefore = await db.select({ key: siteSettings.key, value: siteSettings.value }).from(siteSettings);
  knowledgeBefore = await db.select().from(aiKnowledge);
});

beforeEach(async () => {
  await db.execute(sql`truncate table notifications, escalations, leads, messages, conversations, customers cascade`);
});

afterAll(async () => {
  await db.execute(sql`truncate table notifications, escalations, leads, messages, conversations, customers cascade`);
  await db.delete(siteSettings);
  if (settingsBefore.length) await db.insert(siteSettings).values(settingsBefore);
  await db.delete(aiKnowledge);
  if (knowledgeBefore.length) await db.insert(aiKnowledge).values(knowledgeBefore);
  await closeDb();
});

describe("the inbox", () => {
  it("lists who is waiting, with the question and the customer's name", async () => {
    const { id } = await conversationWaiting();
    await handleMessage({ ...visitor(), text: "Just looking, thanks" }, says("You're welcome!"));

    expect(await countWaitingConversations()).toBe(1);
    const waiting = await listInbox("waiting");
    expect(waiting.total).toBe(1);
    expect(waiting.items[0]).toMatchObject({ id, customerName: "Sana", channel: "web", state: "waiting_for_owner" });
    expect(waiting.items[0].waiting).toEqual([{ reason: "cannot_answer", question: "Do you deliver to Orlando?" }]);
    expect(waiting.items[0].lastMessage).toEqual({ sender: "agent", body: "Let me check with the owner and get back to you." });
    expect((await listInbox("all")).total).toBe(2);
  });

  it("shows the whole conversation, including buying interest", async () => {
    const who = visitor();
    await handleMessage(
      { ...who, text: "I want PLW-0001" },
      scripted(async (req) => {
        await req.runTool("get_product", { product_id: "PLW-0001" });
        const recorded = await req.runTool("record_purchase_interest", {
          product_id: "PLW-0001",
          request_type: "purchase_request",
          customer_request: "Wants to buy and collect on Saturday.",
          conversation_summary: "Customer wants the teal suit.",
        });
        expect(recorded.isError, recorded.content).toBeFalsy();
        return "I've passed your request for PLW-0001 to the owner.";
      }),
    );
    const { items } = await listInbox("waiting");
    const conversation = await getInboxConversation(items[0].id);
    expect(conversation!.messages.map((m) => m.sender)).toEqual(["customer", "agent"]);
    expect(conversation!.interest).toHaveLength(1);
    expect(conversation!.interest[0]).toMatchObject({ productCode: "PLW-0001", stage: "purchase_request", productStatus: "available" });
    expect(conversation!.requests[0]).toMatchObject({ reason: "purchase_request", resolvedAt: null });
    expect(await getInboxConversation("not-an-id")).toBeNull();
    expect(await getInboxConversation(randomUUID())).toBeNull();
  });
});

describe("the owner replying", () => {
  it("puts the reply in the customer's chat, marked as from the owner, and clears the waiting request", async () => {
    const { who, id } = await conversationWaiting();
    expect(await isAwaitingOwner("web", who.identity)).toBe(true);

    await replyAsOwner(admin, id, "  Yes, I can meet you in Orlando on Sunday.  ");

    const history = await loadHistory("web", who.identity);
    expect(history.at(-1)).toMatchObject({ from: "owner", text: "Yes, I can meet you in Orlando on Sunday." });
    expect(await countWaitingConversations()).toBe(0);
    const [request] = await db.select().from(escalations).where(eq(escalations.conversationId, id));
    expect(request.ownerAnswer).toBe("Yes, I can meet you in Orlando on Sunday.");
    expect((await getInboxConversation(id))!.state).toBe("owner");

    // The audit log records that a reply happened, not what was said.
    const audit = await db.select().from(auditLog).where(eq(auditLog.entityId, id));
    expect(audit.map((a) => a.action)).toContain("inbox.reply");
    expect(JSON.stringify(audit)).not.toContain("Orlando");
  });

  it("keeps the assistant silent while the owner is handling the conversation", async () => {
    const { who, id } = await conversationWaiting();
    await replyAsOwner(admin, id, "Hello, this is the owner.");

    const model = says("I should not be speaking.");
    const reply = await handleMessage({ ...who, text: "Great, what time?" }, model);
    expect(model.calls).toHaveLength(0);
    expect(reply).toMatchObject({ reply: SAFE_REPLIES.ownerHandling, limited: "owner", awaitingOwner: true, handoff: true });

    // The customer's message is kept for the owner to read.
    const thread = (await getInboxConversation(id))!.messages;
    expect(thread.filter((m) => m.sender === "customer").at(-1)!.body).toBe("Great, what time?");
    expect(thread.some((m) => m.sender === "agent" && m.body.includes("should not"))).toBe(false);
  });

  it("lets the assistant answer again once handed back, knowing what the owner said", async () => {
    const { who, id } = await conversationWaiting();
    await replyAsOwner(admin, id, "Pickup is at 3pm on Sunday.");
    await handBackToAssistant(admin, id);

    const model = says("See you on Sunday!");
    const reply = await handleMessage({ ...who, text: "Thanks!" }, model);
    expect(reply.reply).toBe("See you on Sunday!");
    expect(reply.awaitingOwner).toBe(false);
    expect(model.calls[0].history.some((h) => h.role === "assistant" && h.text.includes("3pm on Sunday"))).toBe(true);
  });

  it("brings the assistant back by itself if the owner has been quiet for a day", async () => {
    const { who, id } = await conversationWaiting();
    await replyAsOwner(admin, id, "I'll get back to you.");
    const longAgo = new Date(Date.now() - (OWNER_QUIET_HOURS + 1) * 60 * 60 * 1000);
    await db.update(messages).set({ createdAt: longAgo }).where(eq(messages.sender, "owner"));

    const model = says("How can I help?");
    const reply = await handleMessage({ ...who, text: "Hello again" }, model);
    expect(model.calls).toHaveLength(1);
    expect(reply.reply).toBe("How can I help?");
    expect((await getInboxConversation(id))!.state).toBe("agent");
  });

  it("refuses empty, oversized and misdirected replies", async () => {
    const { id } = await conversationWaiting();
    await expect(replyAsOwner(admin, id, "   ")).rejects.toBeInstanceOf(AdminActionError);
    await expect(replyAsOwner(admin, id, "x".repeat(2001))).rejects.toBeInstanceOf(AdminActionError);
    await expect(replyAsOwner(admin, randomUUID(), "Hello")).rejects.toThrow(/no longer exists/);
    // WhatsApp conversations cannot be answered from here until that milestone.
    await db.update(conversations).set({ channel: "whatsapp" }).where(eq(conversations.id, id));
    await expect(replyAsOwner(admin, id, "Hello")).rejects.toThrow(/WhatsApp/);
    expect((await getInboxConversation(id))!.messages.some((m) => m.sender === "owner")).toBe(false);
  });

  it("can mark a request as dealt with without sending anything", async () => {
    const { who, id } = await conversationWaiting();
    await markDealtWith(admin, id);
    expect(await countWaitingConversations()).toBe(0);
    expect((await getInboxConversation(id))!.state).toBe("agent");
    expect(await isAwaitingOwner("web", who.identity)).toBe(false);
    expect((await loadHistory("web", who.identity)).some((m) => m.from === "owner")).toBe(false);
  });
});

describe("the assistant's settings and shop information", () => {
  const form = async (changes: Record<string, string | undefined>) => {
    const current = (await getSettings()).ai_assistant;
    const raw: Record<string, string> = {
      assistant__name: current.name,
      assistant__greeting: current.greeting,
      assistant__instructions: current.instructions,
      assistant__handoffMessage: current.handoffMessage,
      assistant__dailyMessageLimit: String(current.dailyMessageLimit),
      ...(current.enabled ? { assistant__enabled: "on" } : {}),
    };
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) delete raw[`assistant__${key}`];
      else raw[`assistant__${key}`] = value;
    }
    return saveSettingsSection(admin, "assistant", raw);
  };

  it("changes the name and tone guidance, which reach the assistant's instructions", async () => {
    expect((await form({ name: "Noor", instructions: "Keep replies to two sentences." })).ok).toBe(true);
    const settings = await getSettings();
    const prompt = buildSystemPrompt(settings, await listActiveKnowledge(), "web");
    expect(prompt).toContain("Noor");
    expect(prompt).toContain("Keep replies to two sentences.");
    expect((await form({ name: "" })).ok).toBe(false);
    await form({ name: "Skyra", instructions: "" });
  });

  it("a daily limit of 0 pauses the assistant without calling the AI", async () => {
    await form({ dailyMessageLimit: "0" });
    const model = says("Hello!");
    const reply = await handleMessage({ ...visitor(), text: "Hi" }, model);
    expect(reply.limited).toBe("daily");
    expect(model.calls).toHaveLength(0);
    await form({ dailyMessageLimit: "500" });
  });

  it("can be switched off", async () => {
    await form({ enabled: undefined });
    expect((await getSettings()).ai_assistant.enabled).toBe(false);
    await form({ enabled: "on" });
    expect((await getSettings()).ai_assistant.enabled).toBe(true);
  });

  it("adds, edits, switches off and deletes shop information, and the assistant's instructions follow", async () => {
    const prompt = async () => buildSystemPrompt(await getSettings(), await listActiveKnowledge(), "web");
    const id = await createKnowledge(admin, { kind: "policy", title: "Alterations", content: "We do not offer alterations. ZEBRA-FACT-1" });
    expect(await prompt()).toContain("ZEBRA-FACT-1");

    await updateKnowledge(admin, id, { kind: "faq", title: "Alterations", content: "A tailor nearby can alter items. ZEBRA-FACT-2" });
    expect(await prompt()).toContain("ZEBRA-FACT-2");
    expect(await prompt()).not.toContain("ZEBRA-FACT-1");

    await setKnowledgeActive(admin, id, false);
    expect(await prompt()).not.toContain("ZEBRA-FACT-2");
    expect((await listKnowledge()).find((k) => k.id === id)).toMatchObject({ isActive: false });

    await setKnowledgeActive(admin, id, true);
    await deleteKnowledge(admin, id);
    expect((await listKnowledge()).some((k) => k.id === id)).toBe(false);
    await expect(deleteKnowledge(admin, id)).rejects.toBeInstanceOf(AdminActionError);

    // The deleted text is kept in the audit log.
    const [entry] = await db.select().from(auditLog).where(eq(auditLog.action, "knowledge.delete")).orderBy(sql`created_at desc`).limit(1);
    expect(JSON.stringify(entry.details)).toContain("ZEBRA-FACT-2");
  });

  it("checks shop information before saving", () => {
    expect(knowledgeInputSchema.safeParse({ kind: "policy", title: "", content: "x" }).success).toBe(false);
    expect(knowledgeInputSchema.safeParse({ kind: "rumour", title: "Title", content: "Content" }).success).toBe(false);
    expect(knowledgeInputSchema.safeParse({ kind: "faq", title: "Title", content: "x".repeat(2001) }).success).toBe(false);
  });
});
