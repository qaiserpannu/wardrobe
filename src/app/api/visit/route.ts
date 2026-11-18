import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { placeFromHeaders } from "@/lib/visit-source";
import { ADMIN_COOKIE, clientAddress } from "@/server/auth/session";
import { recordVisit } from "@/server/services/visits";

/**
 * Counts a page view or a tap on a WhatsApp button (D48). Called quietly by
 * the public pages. It always answers "204 No Content" and says nothing, so
 * it cannot be used to learn anything about the shop.
 */

const bodySchema = z.object({
  kind: z.enum(["view", "whatsapp"]),
  url: z.string().min(1).max(600).startsWith("/"),
  referrer: z.string().max(600).optional(),
  entry: z.boolean().optional(),
});

/** A brake per network address, so one visitor cannot flood the counts. */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;
const hits = new Map<string, number[]>();

function tooManyFrom(address: string): boolean {
  const now = Date.now();
  const recent = (hits.get(address) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(address, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

const done = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const origin = request.headers.get("origin");
  try {
    if (origin && new URL(origin).host !== host) return done();
  } catch {
    return done();
  }
  // The owner looking at her own shop while signed in is not a visitor.
  if ((await cookies()).has(ADMIN_COOKIE)) return done();

  const raw = await request.text();
  if (raw.length > 2000) return done();
  let parsed;
  try {
    parsed = bodySchema.safeParse(JSON.parse(raw));
  } catch {
    return done();
  }
  if (!parsed.success) return done();

  const address = await clientAddress();
  if (tooManyFrom(address)) return done();

  await recordVisit({
    kind: parsed.data.kind,
    url: parsed.data.url,
    referrer: parsed.data.referrer || undefined,
    entry: parsed.data.entry === true,
    address,
    userAgent: request.headers.get("user-agent"),
    ownHost: host,
    place: placeFromHeaders((name) => request.headers.get(name)),
  });
  return done();
}
