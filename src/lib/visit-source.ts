/**
 * Working out where a visit came from, for the admin "Visitors" page (D48).
 * Pure functions: no database, no network.
 */

export const VISIT_SOURCES = {
  facebook: "Facebook",
  instagram: "Instagram",
  google: "Google",
  search: "Other search engines",
  whatsapp: "WhatsApp",
  other: "Other websites",
  direct: "Direct or a shared link",
} as const;

export type VisitSource = keyof typeof VISIT_SOURCES;

const HOSTS: [RegExp, VisitSource][] = [
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, "facebook"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)(bing\.com|duckduckgo\.com|yahoo\.com|ecosia\.org|brave\.com|yandex\.[a-z]+)$/, "search"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "whatsapp"],
];

const TAGS: Record<string, VisitSource> = {
  facebook: "facebook",
  fb: "facebook",
  instagram: "instagram",
  ig: "instagram",
  google: "google",
  whatsapp: "whatsapp",
  wa: "whatsapp",
};

function hostOf(referrer: string): string | null {
  // Android apps announce themselves as "android-app://com.package.name".
  const app = /^android-app:\/\/([a-z0-9._]+)/i.exec(referrer);
  if (app) return app[1].toLowerCase();
  try {
    const url = new URL(referrer);
    return url.protocol === "http:" || url.protocol === "https:" ? url.hostname.toLowerCase().replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

/**
 * Where a visit began. `null` means the visitor was already on our site
 * (the previous page was ours), so this is not the start of a visit.
 */
export function classifySource(
  referrer: string | undefined,
  search: string,
  ownHost: string,
): { source: VisitSource; host: string | null } | null {
  const params = new URLSearchParams(search);
  const host = referrer ? hostOf(referrer) : null;
  const own = ownHost.toLowerCase().replace(/^www\./, "").replace(/:\d+$/, "");
  if (host && host === own) return null;

  // Links we post ourselves can carry a label; the apps add their own too.
  const tag = params.get("utm_source")?.toLowerCase().trim();
  if (tag && TAGS[tag]) return { source: TAGS[tag], host };
  if (params.has("fbclid")) return { source: "facebook", host };
  if (params.has("igshid") || params.has("igsh")) return { source: "instagram", host };
  if (params.has("gclid")) return { source: "google", host };

  if (!host) return { source: "direct", host: null };
  if (host.startsWith("com.google.")) return { source: "google", host };
  if (host.startsWith("com.facebook.")) return { source: "facebook", host };
  if (host.startsWith("com.instagram.")) return { source: "instagram", host };
  if (host === "com.whatsapp") return { source: "whatsapp", host };
  for (const [pattern, source] of HOSTS) if (pattern.test(host)) return { source, host };
  return { source: "other", host };
}

/** Search engines, link previewers and monitoring tools are not counted as visitors. */
export function isAutomatedVisitor(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.length < 20) return true;
  return /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp\/|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|okhttp|axios|node-fetch|go-http/i.test(
    userAgent,
  );
}

/** The pages worth counting. Anything else (and anything odd) is ignored. */
export function countablePath(pathname: string): { path: string; slug: string | null } | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === "/" || path === "/shop" || path === "/terms" || path === "/privacy") return { path, slug: null };
  const item = /^\/shop\/([a-z0-9][a-z0-9-]{0,120})$/.exec(path);
  return item ? { path, slug: item[1] } : null;
}

export interface VisitPlace {
  country: string | null;
  region: string | null;
  city: string | null;
}

const clean = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const text = value.replace(/[^\p{L}\p{N} .,'()-]/gu, "").trim().slice(0, 80);
  return text || null;
};

/**
 * Netlify tells the site roughly where a visitor is in an "x-nf-geo" header
 * (JSON, usually base64-encoded). Anything unexpected gives "unknown".
 */
export function parsePlace(geoHeader: string | null | undefined, countryHeader?: string | null): VisitPlace {
  const fallback: VisitPlace = { country: clean(countryHeader), region: null, city: null };
  if (!geoHeader) return fallback;
  for (const text of [geoHeader, safeBase64(geoHeader)]) {
    if (!text) continue;
    try {
      const geo = JSON.parse(text) as { city?: unknown; country?: { name?: unknown; code?: unknown }; subdivision?: { name?: unknown; code?: unknown } };
      if (!geo || typeof geo !== "object") continue;
      return {
        country: clean(geo.country?.name) ?? clean(geo.country?.code) ?? fallback.country,
        region: clean(geo.subdivision?.name) ?? clean(geo.subdivision?.code),
        city: clean(geo.city),
      };
    } catch {
      // try the next reading
    }
  }
  return fallback;
}

function safeBase64(value: string): string | null {
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return null;
  }
}

/** Country code ("US") to a readable name ("United States"). Unknown codes stay as they are. */
function countryName(code: string | null): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames("en", { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/**
 * The visitor's rough place from whichever host the site runs on: Netlify's
 * "x-nf-geo", or Vercel's separate "x-vercel-ip-*" headers (the city arrives
 * percent-encoded) (D49). Anything missing or odd gives "unknown".
 */
export function placeFromHeaders(header: (name: string) => string | null): VisitPlace {
  const netlify = parsePlace(header("x-nf-geo"), header("x-country"));
  if (netlify.city || netlify.region || netlify.country) return netlify;
  let city = header("x-vercel-ip-city");
  try {
    if (city) city = decodeURIComponent(city);
  } catch {
    // leave it as sent; clean() below removes anything odd
  }
  const code = clean(header("x-vercel-ip-country"));
  return { country: countryName(code), region: clean(header("x-vercel-ip-country-region")), city: clean(city) };
}

