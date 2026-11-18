/**
 * Which request header to trust for the visitor's network address (D49).
 *
 * Each host sets its own header and overwrites anything the visitor sent
 * under that name; a header from another host is NOT overwritten, so it
 * could be made up by the visitor. So the choice depends on where the site
 * is running, never on which header happens to be present.
 */
export function pickClientAddress(header: (name: string) => string | null, env: { VERCEL?: string | undefined }): string {
  const first = (value: string | null) => value?.split(",")[0]?.trim() || null;
  if (env.VERCEL) {
    const trusted = first(header("x-vercel-forwarded-for")) ?? first(header("x-real-ip")) ?? first(header("x-forwarded-for"));
    if (trusted) return trusted;
  } else {
    // Netlify sets this itself and the visitor cannot fake it.
    const trusted = header("x-nf-client-connection-ip")?.trim();
    if (trusted) return trusted;
  }
  return first(header("x-forwarded-for")) ?? header("x-real-ip") ?? "unknown";
}
