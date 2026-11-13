import "server-only";
import { z } from "zod";
import { CONDITIONS, CONDITION_LABELS } from "@/lib/conditions";
import { formatPrice } from "@/lib/money";
import { OCCASIONS, OCCASION_LABELS, STITCHING, STITCHING_LABELS, piecesLabel } from "@/lib/product-options";
import type { SiteSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/site-url";
import { listCategoryTree } from "@/server/services/categories";
import {
  createEscalation,
  recordLead,
  setConversationState,
  updateCustomerDetails,
} from "@/server/services/conversations";
import { getProductByCode, listProducts } from "@/server/services/products";
import type { PublicProduct } from "@/server/services/types";
import { notifyOwner } from "./notify";
import type { AgentTool, ToolOutcome } from "./types";

/**
 * Everything the agent can do. Inventory tools only read, through the same
 * public service functions the website uses. The three record-keeping tools
 * write conversation records and nothing else.
 */

export type ToolContext = {
  conversationId: string;
  customerId: string;
  channel: "web" | "whatsapp";
  settings: SiteSettings;
  /** Set when the customer asked for a person during this turn. */
  handoffRequested: boolean;
};

const STATUS_WORDS = { available: "available", pending: "on hold", sold: "sold" } as const;

/** The product exactly as recorded, in words the model can pass on. Public fields only. */
function describe(p: PublicProduct, settings: SiteSettings, full: boolean) {
  return {
    product_id: p.code,
    name: p.name,
    status: STATUS_WORDS[p.status],
    price: formatPrice(p.priceCents, settings.shop.currency, settings.shop.locale),
    category: p.group ? `${p.group.name} > ${p.category.name}` : p.category.name,
    size: p.size ?? "not recorded",
    brand: p.brand ?? "not recorded",
    colour: p.color ?? "not recorded",
    fabric: p.fabric ?? "not recorded",
    pieces: p.pieces ? piecesLabel(p.pieces) : "not recorded",
    stitching: p.stitching ? STITCHING_LABELS[p.stitching] : "not recorded",
    occasion: p.occasion ? OCCASION_LABELS[p.occasion] : "not recorded",
    condition: CONDITION_LABELS[p.condition],
    imperfections: p.imperfections ?? "none recorded (this does not mean there are none)",
    description: full ? p.description : p.description.slice(0, 240),
    link: `${siteUrl()}/shop/${p.slug}`,
  };
}

const json = (value: unknown): ToolOutcome => ({ content: JSON.stringify(value) });
const fail = (message: string): ToolOutcome => ({ content: message, isError: true });

const text = (max: number) => z.string().trim().max(max);

const searchInput = z.object({
  keywords: text(80).optional(),
  category: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{1,60}$/)
    .optional(),
  size: text(30).optional(),
  occasion: z.enum(OCCASIONS).optional(),
  stitching: z.enum(STITCHING).optional(),
  condition: z.enum(CONDITIONS).optional(),
  min_price: z.number().min(0).max(1_000_000).optional(),
  max_price: z.number().min(0).max(1_000_000).optional(),
  include_unavailable: z.boolean().optional(),
});

const productInput = z.object({ product_id: text(20) });

const interestInput = z.object({
  product_id: text(20),
  request_type: z.enum(["purchase_request", "reservation_request"]),
  customer_name: text(120).optional(),
  customer_contact: text(120).optional(),
  customer_request: text(500),
  conversation_summary: text(800),
});

const escalateInput = z.object({
  question: text(500).min(3),
  conversation_summary: text(800),
  customer_name: text(120).optional(),
  customer_contact: text(120).optional(),
});

const humanInput = z.object({
  conversation_summary: text(800),
  customer_name: text(120).optional(),
  customer_contact: text(120).optional(),
});

const optionalString = { type: "string" } as const;

export const AGENT_TOOLS: AgentTool[] = [
  {
    name: "search_products",
    description:
      "Search the shop's current inventory. Returns up to 8 items with all recorded details. By default only available items are returned. Use one or two plain keywords (for example 'lehenga' or 'green silk') plus the filters; long phrases match nothing. Call list_categories first if you need the category names.",
    inputSchema: {
      type: "object",
      properties: {
        keywords: { type: "string", description: "One or two words: garment type, colour, fabric or brand." },
        category: { type: "string", description: "A category or group slug from list_categories, e.g. 'sarees' or 'women'." },
        size: { type: "string", description: "Exact recorded size, e.g. 'M', 'L', 'Free size', '6-7 years'." },
        occasion: { type: "string", enum: [...OCCASIONS] },
        stitching: { type: "string", enum: [...STITCHING] },
        condition: { type: "string", enum: [...CONDITIONS] },
        min_price: { type: "number", description: "In whole currency units." },
        max_price: { type: "number", description: "In whole currency units." },
        include_unavailable: {
          type: "boolean",
          description: "Also return items that are on hold or sold. Only for answering a question about such an item.",
        },
      },
    },
  },
  {
    name: "get_product",
    description:
      "Read one product's full, current record by its product ID (for example PLW-0012), including its status right now. Use this before answering any question about a specific item.",
    inputSchema: {
      type: "object",
      properties: { product_id: { type: "string" } },
      required: ["product_id"],
    },
  },
  {
    name: "list_categories",
    description: "List the shop's categories and groups with how many items are available in each.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "record_purchase_interest",
    description:
      "Tell the owner that the customer clearly wants to buy or reserve one specific available item. This does not sell, reserve or hold anything; the owner decides. Use it only for a clear request, not for general interest or questions.",
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "string" },
        request_type: { type: "string", enum: ["purchase_request", "reservation_request"] },
        customer_name: { ...optionalString, description: "Only if the customer gave it." },
        customer_contact: { ...optionalString, description: "Phone or WhatsApp number, only if the customer gave it." },
        customer_request: { type: "string", description: "What the customer asked for or agreed to, in their terms." },
        conversation_summary: { type: "string", description: "Two or three sentences for the owner." },
      },
      required: ["product_id", "request_type", "customer_request", "conversation_summary"],
    },
  },
  {
    name: "escalate_question",
    description:
      "Pass a question to the owner when the answer is not in the inventory records or the approved shop information. Use this instead of guessing.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string", description: "The customer's question, stated clearly for the owner." },
        conversation_summary: { type: "string" },
        customer_name: optionalString,
        customer_contact: optionalString,
      },
      required: ["question", "conversation_summary"],
    },
  },
  {
    name: "request_human",
    description: "Notify the owner that the customer wants to talk to a person. Call it as soon as they ask.",
    inputSchema: {
      type: "object",
      properties: {
        conversation_summary: { type: "string" },
        customer_name: optionalString,
        customer_contact: optionalString,
      },
      required: ["conversation_summary"],
    },
  },
];

function contactLines(name?: string, contact?: string, channel?: string) {
  return [
    `Customer name: ${name?.trim() || "not given"}`,
    `Contact: ${contact?.trim() || "not given"}`,
    `Channel: ${channel === "whatsapp" ? "WhatsApp" : "website chat"}`,
  ].join("\n");
}

/** Runs one tool call. Input is untrusted (it was written by the model) and is validated here. */
export async function runAgentTool(ctx: ToolContext, name: string, rawInput: unknown): Promise<ToolOutcome> {
  const { settings } = ctx;
  switch (name) {
    case "search_products": {
      const parsed = searchInput.safeParse(rawInput ?? {});
      if (!parsed.success) return fail("Invalid search input. Check the field names and values.");
      const f = parsed.data;
      const { items, total } = await listProducts(
        {
          q: f.keywords ?? "",
          category: f.category ?? null,
          sizes: f.size ? [f.size] : [],
          occasions: f.occasion ? [f.occasion] : [],
          stitching: f.stitching ? [f.stitching] : [],
          conditions: f.condition ? [f.condition] : [],
          minPriceCents: f.min_price != null ? Math.round(f.min_price * 100) : null,
          maxPriceCents: f.max_price != null ? Math.round(f.max_price * 100) : null,
          hideSold: !f.include_unavailable,
        },
        8,
      );
      return json({
        total_matches: total,
        showing: items.length,
        note: total === 0 ? "Nothing in the inventory matches these conditions." : undefined,
        products: items.map((p) => describe(p, settings, false)),
      });
    }

    case "get_product": {
      const parsed = productInput.safeParse(rawInput);
      if (!parsed.success) return fail("A product_id such as PLW-0012 is required.");
      const product = await getProductByCode(parsed.data.product_id);
      if (!product) return json({ found: false, note: "No product with this ID is listed in the shop." });
      return json({ found: true, product: describe(product, settings, true) });
    }

    case "list_categories": {
      const tree = await listCategoryTree();
      return json(
        tree.map((g) => ({
          group: g.name,
          slug: g.slug,
          available_items: g.availableCount,
          categories: g.children.map((c) => ({ name: c.name, slug: c.slug, available_items: c.availableCount })),
        })),
      );
    }

    case "record_purchase_interest": {
      const parsed = interestInput.safeParse(rawInput);
      if (!parsed.success) return fail("Invalid input. product_id, request_type, customer_request and conversation_summary are required.");
      const input = parsed.data;
      const product = await getProductByCode(input.product_id);
      if (!product) return fail("No product with this ID is listed. Nothing was recorded.");
      if (product.status !== "available") {
        return fail(
          `This item is ${STATUS_WORDS[product.status]}, so a purchase request cannot be recorded. Tell the customer it is ${STATUS_WORDS[product.status]} and offer similar available items.`,
        );
      }
      await updateCustomerDetails(ctx.customerId, { name: input.customer_name, contact: input.customer_contact });
      await recordLead({
        conversationId: ctx.conversationId,
        productCode: product.code,
        stage: input.request_type,
        summary: input.conversation_summary,
        customerRequest: input.customer_request,
      });
      const p = describe(product, settings, false);
      const wants = input.request_type === "reservation_request" ? "asks to reserve" : "wants to buy";
      await notifyOwner(
        {
          conversationId: ctx.conversationId,
          kind: "purchase_request",
          dedupeKey: `interest:${ctx.conversationId}:${product.code}:${input.request_type}`,
          subject: `Buyer: ${product.name} (${product.code})`,
          body: [
            `A customer ${wants} this item.`,
            "",
            contactLines(input.customer_name, input.customer_contact, ctx.channel),
            "",
            `Product: ${product.name}`,
            `Product ID: ${product.code}`,
            `Price: ${p.price}`,
            `Link: ${p.link}`,
            "",
            `What the customer asked for: ${input.customer_request}`,
            "",
            `Summary: ${input.conversation_summary}`,
            "",
            "Nothing has been reserved or sold. The item's status has not changed.",
          ].join("\n"),
        },
        settings.ai_assistant.notifyEmail,
      );
      return json({
        recorded: true,
        tell_the_customer:
          "Their request has been passed to the owner, who will confirm availability and arrange pickup and payment. The item is NOT reserved or sold yet.",
        contact_given: Boolean(input.customer_contact?.trim()),
      });
    }

    case "escalate_question": {
      const parsed = escalateInput.safeParse(rawInput);
      if (!parsed.success) return fail("Invalid input. question and conversation_summary are required.");
      const input = parsed.data;
      await updateCustomerDetails(ctx.customerId, { name: input.customer_name, contact: input.customer_contact });
      const normalized = input.question.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 120);
      const isNew = await notifyOwner(
        {
          conversationId: ctx.conversationId,
          kind: "cannot_answer",
          dedupeKey: `question:${ctx.conversationId}:${normalized}`,
          subject: "Customer question the assistant could not answer",
          body: [
            `Question: ${input.question}`,
            "",
            contactLines(input.customer_name, input.customer_contact, ctx.channel),
            "",
            `Summary: ${input.conversation_summary}`,
          ].join("\n"),
        },
        settings.ai_assistant.notifyEmail,
      );
      if (isNew) {
        await createEscalation({ conversationId: ctx.conversationId, reason: "cannot_answer", question: input.question });
        await setConversationState(ctx.conversationId, "waiting_for_owner");
      }
      return json({
        recorded: true,
        tell_the_customer:
          "You need to confirm this with the owner and have passed the question on. If they have not shared a phone or WhatsApp number, the owner cannot reply to them here, so suggest the WhatsApp button in the chat or ask for a number.",
        contact_given: Boolean(input.customer_contact?.trim()),
      });
    }

    case "request_human": {
      const parsed = humanInput.safeParse(rawInput);
      if (!parsed.success) return fail("Invalid input. conversation_summary is required.");
      const input = parsed.data;
      await updateCustomerDetails(ctx.customerId, { name: input.customer_name, contact: input.customer_contact });
      const day = new Date().toISOString().slice(0, 10);
      const isNew = await notifyOwner(
        {
          conversationId: ctx.conversationId,
          kind: "human_requested",
          dedupeKey: `human:${ctx.conversationId}:${day}`,
          subject: "A customer asked to talk to you",
          body: [
            "A customer asked to speak to a person.",
            "",
            contactLines(input.customer_name, input.customer_contact, ctx.channel),
            "",
            `Summary: ${input.conversation_summary}`,
          ].join("\n"),
        },
        settings.ai_assistant.notifyEmail,
      );
      if (isNew) {
        await createEscalation({ conversationId: ctx.conversationId, reason: "human_requested", question: input.conversation_summary });
        await setConversationState(ctx.conversationId, "waiting_for_owner");
      }
      ctx.handoffRequested = true;
      return json({ recorded: true, tell_the_customer: settings.ai_assistant.handoffMessage });
    }

    default:
      return fail(`Unknown tool "${name}".`);
  }
}
