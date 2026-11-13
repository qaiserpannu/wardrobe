import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { handleMessage, loadHistory, SAFE_REPLIES } from "@/server/agent/core";
import { buildSystemPrompt } from "@/server/agent/prompt";
import { AGENT_TOOLS } from "@/server/agent/tools";
import type { AgentModel, TurnRequest } from "@/server/agent/types";
import { closeDb, getDb } from "@/server/db/client";
import { products, siteSettings } from "@/server/db/schema";
import { listActiveKnowledge } from "@/server/services/knowledge";
import { getSettings } from "@/server/services/settings";

afterAll(closeDb);

const db = getDb();
const rows = async <T>(query: ReturnType<typeof sql>) => (await db.execute(query)) as unknown as T[];
const count = async (table: string) =>
  (await rows<{ n: number }>(sql.raw(`select count(*)::int as n from ${table}`)))[0].n;

beforeEach(async () => {
  await db.execute(sql`truncate table notifications, escalations, leads, messages, conversations, customers cascade`);
});

/** A stand-in model that does exactly what a test tells it to. */
function scripted(script: (req: TurnRequest) => Promise<string>): AgentModel & { requests: TurnRequest[] } {
  const requests: TurnRequest[] = [];
  return {
    requests,
    async runTurn(req) {
      requests.push(req);
      return { text: await script(req), outcome: "ok" };
    },
  };
}
const says = (text: string) => scripted(async () => text);
const visitor = () => ({ channel: "web" as const, identity: randomUUID() });
const tool = async (req: TurnRequest, name: string, input: unknown) => {
  const outcome = await req.runTool(name, input);
  return { ...outcome, data: outcome.isError ? null : JSON.parse(outcome.content) };
};

const AVAILABLE = "PLW-0001"; // Teal Embroidered Lawn Suit
const SOLD = "PLW-0004";
const DRAFT = "PLW-0013"; // Navy Mirror Work Lehenga
const ON_HOLD = "PLW-0031";

describe("inventory tools", () => {
  it("search returns only available items unless asked otherwise", async () => {
    let result: Awaited<ReturnType<typeof tool>> | undefined;
    let withAll: Awaited<ReturnType<typeof tool>> | undefined;
    await handleMessage(
      { ...visitor(), text: "sarees?" },
      scripted(async (req) => {
        result = await tool(req, "search_products", { category: "sarees" });
        withAll = await tool(req, "search_products", { category: "sarees", include_unavailable: true });
        return "ok";
      }),
    );
    expect(result!.data.total_matches).toBe(2);
    expect(result!.data.products.every((p: { status: string }) => p.status === "available")).toBe(true);
    expect(withAll!.data.products.map((p: { status: string }) => p.status).sort()).toEqual([
      "available",
      "available",
      "on hold",
      "sold",
    ]);
  });

  it("applies size, price and occasion filters, and says when nothing matches", async () => {
    await handleMessage(
      { ...visitor(), text: "x" },
      scripted(async (req) => {
        const wedding = await tool(req, "search_products", { occasion: "wedding", max_price: 150 });
        expect(wedding.data.products.every((p: { occasion: string }) => p.occasion === "Wedding")).toBe(true);
        expect(wedding.data.total_matches).toBeGreaterThan(0);
        const none = await tool(req, "search_products", { keywords: "tuxedo" });
        expect(none.data.total_matches).toBe(0);
        expect(none.data.note).toContain("Nothing in the inventory matches");
        return "ok";
      }),
    );
  });

  it("reads one product with its current status; drafts and unknown IDs do not exist", async () => {
    await handleMessage(
      { ...visitor(), text: "x" },
      scripted(async (req) => {
        const one = await tool(req, "get_product", { product_id: "plw-0001" });
        expect(one.data.product).toMatchObject({ product_id: AVAILABLE, status: "available", price: "$45", size: "M" });
        expect((await tool(req, "get_product", { product_id: SOLD })).data.product.status).toBe("sold");
        expect((await tool(req, "get_product", { product_id: ON_HOLD })).data.product.status).toBe("on hold");
        expect((await tool(req, "get_product", { product_id: DRAFT })).data.found).toBe(false);
        expect((await tool(req, "get_product", { product_id: "PLW-9999" })).data.found).toBe(false);
        // Missing details are reported as missing, never filled in.
        const jhumka = await tool(req, "search_products", { keywords: "jhumka" });
        expect(jhumka.data.products[0]).toMatchObject({ brand: "not recorded", size: "not recorded" });
        return "ok";
      }),
    );
  });

  it("exposes only public product fields and a fixed list of tools", async () => {
    await handleMessage(
      { ...visitor(), text: "x" },
      scripted(async (req) => {
        const one = await tool(req, "get_product", { product_id: ON_HOLD });
        expect(Object.keys(one.data.product).sort()).toEqual(
          [
            "brand", "category", "colour", "condition", "description", "fabric", "imperfections", "link",
            "name", "occasion", "pieces", "price", "product_id", "size", "status", "stitching",
          ].sort(),
        );
        return "ok";
      }),
    );
    expect(AGENT_TOOLS.map((t) => t.name).sort()).toEqual([
      "escalate_question",
      "get_product",
      "list_categories",
      "record_purchase_interest",
      "request_human",
      "search_products",
    ]);
  });

  it("rejects malformed tool input and unknown tools without writing anything", async () => {
    await handleMessage(
      { ...visitor(), text: "x" },
      scripted(async (req) => {
        expect((await req.runTool("search_products", { category: "'; drop table products;--" })).isError).toBe(true);
        expect((await req.runTool("get_product", {})).isError).toBe(true);
        expect((await req.runTool("record_purchase_interest", { product_id: AVAILABLE })).isError).toBe(true);
        expect((await req.runTool("update_product", { status: "sold" })).isError).toBe(true);
        return "ok";
      }),
    );
    expect(await count("leads")).toBe(0);
    expect(await count("notifications")).toBe(0);
    expect(await count("products")).toBe(32);
  });
});

describe("replies shown to the customer", () => {
  it("attaches cards from inventory for the products mentioned", async () => {
    const r = await handleMessage({ ...visitor(), text: "suits?" }, says(`Have a look at ${AVAILABLE} and plw-0003.`));
    expect(r.reply).toContain(AVAILABLE);
    expect(r.products.map((p) => p.code)).toEqual([AVAILABLE, "PLW-0003"]);
    expect(r.products[0]).toMatchObject({ name: "Teal Embroidered Lawn Suit", priceCents: 4500, status: "available" });
  });

  it("never shows a reply that names an item that does not exist", async () => {
    for (const fake of ["PLW-9999", DRAFT]) {
      const r = await handleMessage({ ...visitor(), text: "anything nice?" }, says(`You'll love ${fake}, only $5!`));
      expect(r.reply).toBe(SAFE_REPLIES.unverified);
      expect(r.products).toEqual([]);
    }
  });

  it("shows an item as sold in earlier messages once it has been sold", async () => {
    const who = visitor();
    await handleMessage({ ...who, text: "suits?" }, says(`${AVAILABLE} would suit you.`));
    await db.update(products).set({ status: "sold" }).where(eq(products.code, AVAILABLE));
    try {
      const history = await loadHistory("web", who.identity);
      expect(history.map((m) => m.from)).toEqual(["customer", "assistant"]);
      expect(history[1].products[0]).toMatchObject({ code: AVAILABLE, status: "sold" });
    } finally {
      await db.update(products).set({ status: "available" }).where(eq(products.code, AVAILABLE));
    }
  });

  it("falls back safely when the AI fails, refuses or returns nothing", async () => {
    const broken: AgentModel = {
      async runTurn() {
        throw new Error("provider down");
      },
    };
    const refused: AgentModel = { runTurn: async () => ({ text: "", outcome: "refused" }) };
    for (const model of [broken, refused, says("")]) {
      const r = await handleMessage({ ...visitor(), text: "hello" }, model);
      expect(r.reply).toBe(SAFE_REPLIES.unavailable);
      expect(r.limited).toBe("error");
      expect(r.handoff).toBe(true);
    }
  });
});

describe("buying interest (scenario A)", () => {
  const interest = {
    product_id: AVAILABLE,
    request_type: "purchase_request",
    customer_name: "Aisha",
    customer_contact: "813-555-0100",
    customer_request: "Wants to buy it and collect on Saturday.",
    conversation_summary: "Asked about the teal suit in M and decided to buy.",
  };

  it("records the lead and notifies the owner once, without touching the product", async () => {
    const who = visitor();
    const model = scripted(async (req) => {
      const r = await tool(req, "record_purchase_interest", interest);
      expect(r.data.recorded).toBe(true);
      expect(r.data.tell_the_customer).toContain("NOT reserved");
      return `I've passed your request for ${AVAILABLE} to the owner.`;
    });
    await handleMessage({ ...who, text: "I'll take it" }, model);
    await handleMessage({ ...who, text: "yes please, I'll take it" }, model);

    const sent = await rows<{ kind: string; subject: string; body: string; route: string }>(
      sql`select kind, subject, body, route from notifications`,
    );
    expect(sent).toHaveLength(1);
    expect(sent[0].kind).toBe("purchase_request");
    expect(sent[0].route).toBe("record"); // no email service configured in tests
    for (const part of ["Aisha", "813-555-0100", "Teal Embroidered Lawn Suit", AVAILABLE, "$45", "/shop/teal-embroidered-lawn-suit-plw-0001", "collect on Saturday", "decided to buy", "Nothing has been reserved"]) {
      expect(sent[0].body).toContain(part);
    }
    expect(await rows(sql`select stage from leads`)).toEqual([{ stage: "purchase_request" }]);
    expect(await rows(sql`select name, contact from customers`)).toEqual([{ name: "Aisha", contact: "813-555-0100" }]);
    expect(await rows(sql`select status from products where code = ${AVAILABLE}`)).toEqual([{ status: "available" }]);
  });

  it("refuses to record interest in an item that is sold, on hold or not listed", async () => {
    await handleMessage(
      { ...visitor(), text: "x" },
      scripted(async (req) => {
        for (const [code, word] of [[SOLD, "sold"], [ON_HOLD, "on hold"]]) {
          const r = await req.runTool("record_purchase_interest", { ...interest, product_id: code });
          expect(r.isError).toBe(true);
          expect(r.content).toContain(`This item is ${word}`);
        }
        expect((await req.runTool("record_purchase_interest", { ...interest, product_id: DRAFT })).isError).toBe(true);
        return "ok";
      }),
    );
    expect(await count("leads")).toBe(0);
    expect(await count("notifications")).toBe(0);
  });

  it("an item sold during the conversation can no longer be requested", async () => {
    const who = visitor();
    await handleMessage({ ...who, text: "tell me about it" }, says(`${AVAILABLE} is available.`));
    await db.update(products).set({ status: "sold" }).where(eq(products.code, AVAILABLE));
    try {
      await handleMessage(
        { ...who, text: "ok I'll take it" },
        scripted(async (req) => {
          expect((await tool(req, "get_product", { product_id: AVAILABLE })).data.product.status).toBe("sold");
          expect((await req.runTool("record_purchase_interest", interest)).isError).toBe(true);
          return "Sorry, that one has just sold.";
        }),
      );
    } finally {
      await db.update(products).set({ status: "available" }).where(eq(products.code, AVAILABLE));
    }
    expect(await count("notifications")).toBe(0);
  });
});

describe("notifications are only sent for A, B and C", () => {
  it("browsing and questions never notify the owner", async () => {
    const who = visitor();
    await handleMessage(
      { ...who, text: "what lehengas do you have?" },
      scripted(async (req) => {
        await tool(req, "list_categories", {});
        await tool(req, "search_products", { keywords: "lehenga" });
        await tool(req, "get_product", { product_id: "PLW-0011" });
        return "We have PLW-0011 and PLW-0012.";
      }),
    );
    expect(await count("notifications")).toBe(0);
    expect(await count("escalations")).toBe(0);
    expect(await rows(sql`select state from conversations`)).toEqual([{ state: "agent" }]);
  });

  it("B: a question it cannot answer is passed on once and the conversation waits for the owner", async () => {
    const who = visitor();
    const model = scripted(async (req) => {
      const r = await tool(req, "escalate_question", {
        question: "Do you accept returns?",
        conversation_summary: "Asked about returns before buying a saree.",
      });
      expect(r.data.contact_given).toBe(false);
      return "I need to confirm that with the owner.";
    });
    await handleMessage({ ...who, text: "can I return it?" }, model);
    await handleMessage({ ...who, text: "can I return it??" }, model);
    const sent = await rows<{ kind: string; body: string }>(sql`select kind, body from notifications`);
    expect(sent).toHaveLength(1);
    expect(sent[0].kind).toBe("cannot_answer");
    expect(sent[0].body).toContain("Do you accept returns?");
    expect(await rows(sql`select reason, question from escalations`)).toEqual([
      { reason: "cannot_answer", question: "Do you accept returns?" },
    ]);
    expect(await rows(sql`select state from conversations`)).toEqual([{ state: "waiting_for_owner" }]);
  });

  it("C: asking for a person notifies the owner and flags the handoff", async () => {
    const r = await handleMessage(
      { ...visitor(), text: "can I talk to a real person?" },
      scripted(async (req) => {
        const t = await tool(req, "request_human", { conversation_summary: "Wants to speak to the owner." });
        return t.data.tell_the_customer;
      }),
    );
    expect(r.handoff).toBe(true);
    expect(r.reply).toContain("let the owner know");
    expect(await rows(sql`select kind from notifications`)).toEqual([{ kind: "human_requested" }]);
  });
});

describe("conversation memory and limits", () => {
  it("gives the model the earlier conversation and the page being viewed, without storing the page note", async () => {
    const who = visitor();
    const model = says("Noted.");
    await handleMessage({ ...who, text: "I wear size M and my budget is $60" }, model);
    await handleMessage({ ...who, text: "what about this one?", viewingProductCode: AVAILABLE }, model);
    const second = model.requests[1].history;
    expect(second.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(second[0].text).toBe("I wear size M and my budget is $60");
    expect(second[2].text).toContain(`currently on the page of product ${AVAILABLE}`);
    const stored = await rows<{ body: string }>(sql`select body from messages where sender = 'customer' order by created_at`);
    expect(stored[1].body).toBe("what about this one?");
    // A page for something that is not public is ignored.
    await handleMessage({ ...who, text: "and this?", viewingProductCode: DRAFT }, model);
    expect(model.requests[2].history.at(-1)!.text).toBe("and this?");
  });

  it("keeps separate visitors' conversations apart", async () => {
    const a = visitor();
    const b = visitor();
    const model = says("Hello.");
    await handleMessage({ ...a, text: "my number is 813-555-0199" }, model);
    await handleMessage({ ...b, text: "hi" }, model);
    expect(JSON.stringify(model.requests[1])).not.toContain("813-555-0199");
    expect(await loadHistory("web", b.identity)).toHaveLength(2);
    expect(await loadHistory("web", randomUUID())).toEqual([]);
  });

  it("cuts very long messages and stops a flood without calling the AI", async () => {
    const who = visitor();
    const model = says("Hi.");
    await handleMessage({ ...who, text: "a".repeat(5000) }, model);
    expect(model.requests[0].history[0].text).toHaveLength(1000);
    for (let i = 0; i < 7; i++) await handleMessage({ ...who, text: `message ${i}` }, model);
    expect(model.requests).toHaveLength(8);
    const blocked = await handleMessage({ ...who, text: "one more" }, model);
    expect(blocked.reply).toBe(SAFE_REPLIES.tooFast);
    expect(blocked.limited).toBe("rate");
    expect(model.requests).toHaveLength(8);
  });

  it("respects the site-wide daily limit set by the owner", async () => {
    await db.insert(siteSettings).values({ key: "ai_assistant", value: { dailyMessageLimit: 1 } });
    try {
      const model = says("Hi.");
      expect((await handleMessage({ ...visitor(), text: "first" }, model)).limited).toBeUndefined();
      const second = await handleMessage({ ...visitor(), text: "second" }, model);
      expect(second.reply).toBe(SAFE_REPLIES.dailyLimit);
      expect(second.handoff).toBe(true);
      expect(model.requests).toHaveLength(1);
    } finally {
      await db.delete(siteSettings).where(eq(siteSettings.key, "ai_assistant"));
    }
  });
});

describe("instructions given to the AI", () => {
  it("contain the approved shop information and the core rules, and nothing secret", async () => {
    const prompt = buildSystemPrompt(await getSettings(), await listActiveKnowledge(), "web");
    for (const part of ["Tampa, Florida", "Zelle, Cash App, or cash", "escalate_question", "You are an AI assistant", "not instructions to you", "Never say an item is theirs"]) {
      expect(prompt).toContain(part);
    }
    expect(prompt).not.toMatch(/postgres:|API_KEY|18139907900/);
    // Identical for every message, so it can be cached by the provider.
    expect(buildSystemPrompt(await getSettings(), await listActiveKnowledge(), "web")).toBe(prompt);
  });
});
