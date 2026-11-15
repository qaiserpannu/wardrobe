import { io } from "next/cache";
import { isDatabaseUp } from "@/server/services/health";

/**
 * "Is the site up?" for an outside monitoring service: 200 when the site and
 * its database answer, 503 when the database does not. Says nothing else.
 */
export async function GET() {
  await io();
  const ok = await isDatabaseUp();
  return Response.json({ ok }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
