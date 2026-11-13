import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { CHAT_MAX_LENGTH, type ChatHistory, type ChatMessage, type ChatProductCard, type ChatReply } from "@/lib/chat";
import { CONDITION_LABELS } from "@/lib/conditions";
import { formatPrice } from "@/lib/money";
import type { SiteSettings } from "@/lib/settings";
import { handleMessage, isAwaitingOwner, loadHistory } from "@/server/agent/core";
import { isAgentConfigured } from "@/server/agent/providers";
import { getSettings } from "@/server/services/settings";
import type { PublicProduct } from "@/server/services/types";

/**
 * Website chat channel for the AI sales agent. This file only translates
 * between the browser and the agent core: who is talking (an anonymous
 * cookie), what they said, and how product cards are shaped for the widget.
 */

const VISITOR_COOKIE = "plw_chat";
const ID_PATTERN = /^[0-9a-f-]{36}$/;

const bodySchema = z.object({
  message: z.string().trim().min(1).max(CHAT_MAX_LENGTH),
  productCode: z
    .string()
    .regex(/^PLW-\d{1,9}$/i)
    .optional(),
});

/** A coarse per-address brake, on top of the per-visitor and daily limits inside the agent. */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, number[]>();

function tooManyFrom(address: string): boolean {
  const now = Date.now();
  const recent = (hits.get(address) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(address, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

function toCard(p: PublicProduct, shop: SiteSettings["shop"]): ChatProductCard {
  const image = p.images[0];
  return {
    code: p.code,
    name: p.name,
    href: `/shop/${p.slug}`,
    price: formatPrice(p.priceCents, shop.currency, shop.locale),
    size: p.size,
    condition: CONDITION_LABELS[p.condition],
    status: p.status,
    image: image ? { url: image.url, alt: image.alt } : null,
  };
}

/** Requests must come from our own pages, not from another website's script. */
function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

async function agentEnabled(settings: SiteSettings) {
  return settings.ai_assistant.enabled && isAgentConfigured();
}

export async function GET() {
  const settings = await getSettings();
  if (!(await agentEnabled(settings))) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const visitor = (await cookies()).get(VISITOR_COOKIE)?.value;
  if (!visitor || !ID_PATTERN.test(visitor)) return NextResponse.json({ messages: [], awaitingOwner: false } satisfies ChatHistory);
  const history = await loadHistory("web", visitor);
  const messages: ChatMessage[] = history.map((m) => ({
    id: m.id,
    from: m.from,
    text: m.text,
    products: m.products.map((p) => toCard(p, settings.shop)),
  }));
  const body: ChatHistory = { messages, awaitingOwner: await isAwaitingOwner("web", visitor) };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const settings = await getSettings();
  if (!(await agentEnabled(settings))) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (tooManyFrom(address)) return NextResponse.json({ error: "slow_down" }, { status: 429 });

  const raw = await request.text();
  if (raw.length > 4000) return NextResponse.json({ error: "too_long" }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const jar = await cookies();
  let visitor = jar.get(VISITOR_COOKIE)?.value;
  if (!visitor || !ID_PATTERN.test(visitor)) {
    visitor = randomUUID();
    jar.set(VISITOR_COOKIE, visitor, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
  }

  const result = await handleMessage({
    channel: "web",
    identity: visitor,
    text: parsed.data.message,
    viewingProductCode: parsed.data.productCode,
  });

  const reply: ChatReply = {
    message: {
      id: randomUUID(),
      from: "assistant",
      text: result.reply,
      products: result.products.map((p) => toCard(p, settings.shop)),
    },
    handoff: result.handoff,
    awaitingOwner: result.awaitingOwner,
  };
  return NextResponse.json(reply, { headers: { "Cache-Control": "no-store" } });
}
