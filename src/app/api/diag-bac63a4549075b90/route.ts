// TEMPORARY: connection diagnostics for the first hosting trial. Reports timings
// and error codes only. To be deleted as soon as the fault is found.
import postgres from "postgres";
import { getSql } from "@/server/db/client";
import { connectionOptions } from "@/server/db/connection";
import { getCatalogFacets, listProducts } from "@/server/services/products";

async function step(name: string, run: () => Promise<unknown>) {
  const start = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      run(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout after 8s")), 8000);
      }),
    ]);
    return { name, ms: Date.now() - start, ok: true };
  } catch (error) {
    const e = error as { code?: string; message?: string; cause?: { code?: string; message?: string } };
    return {
      name,
      ms: Date.now() - start,
      ok: false,
      code: e.code ?? e.cause?.code,
      message: String(e.cause?.message ?? e.message ?? error).slice(0, 160),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  const params = new URL(request.url).searchParams;
  const only = params.get("only");
  if (params.get("fresh")) {
    const url = process.env.DATABASE_URL ?? "";
    const n = Number(params.get("n") ?? 8);
    const client = postgres(url, {
      ...connectionOptions(url),
      max: Number(params.get("max") ?? 3),
      ...(params.get("types") === "0" ? { fetch_types: false } : {}),
      ...(params.get("prepare") === "1" ? { prepare: true } : {}),
    });
    const numbers = Array.from({ length: n }, (_, i) => i);
    const result = await step("fresh", () =>
      Promise.all(numbers.map((i) => (params.get("plain") ? client.unsafe("select 1") : client`select ${i}::int`))),
    );
    const second = await step("fresh-again", () => Promise.all(numbers.map((i) => client`select ${i}::int`)));
    client.end({ timeout: 1 }).catch(() => {});
    return Response.json({ query: Object.fromEntries(params), result, second });
  }
  const sql = getSql();
  let port = "?";
  try {
    port = new URL(process.env.DATABASE_URL ?? "").port;
  } catch {}
  const steps: [string, () => Promise<unknown>][] = [
    ["one", () => sql`select 1`],
    ["three-parallel", () => Promise.all([1, 2, 3].map((n) => sql`select ${n}::int`))],
    ["eight-parallel", () => Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map((n) => sql`select ${n}::int`))],
    ["transaction", () => sql.begin((tx) => tx`select 1`)],
    ["transaction+six", () => Promise.all([sql.begin((tx) => tx`select 1`), ...[1, 2, 3, 4, 5, 6].map((n) => sql`select ${n}::int`)])],
    ["listProducts", () => listProducts({})],
    ["facets", () => getCatalogFacets()],
    ["list+facets", () => Promise.all([listProducts({}), getCatalogFacets()])],
  ];
  const results = [];
  for (const [name, run] of steps) {
    if (only && only !== name) continue;
    results.push(await step(name, run));
  }
  return Response.json({ port, poolMax: sql.options.max, region: process.env.AWS_REGION ?? null, node: process.version, results });
}
