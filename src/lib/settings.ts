import { z } from "zod";

/**
 * Site settings are stored in the database as one JSON document per key.
 * Every field has a default, so the site works before anything is configured.
 * The admin portal (Milestone 5) will edit these.
 */
export const settingsSchemas = {
  branding: z.object({
    siteName: z.string().default("Pre-Loved Wardrobe"),
    /** Small line under the site name in the logo. Empty hides it. */
    byline: z.string().default("By Skyra"),
    tagline: z.string().default("Pre-loved Indian & Pakistani fashion, chosen with care."),
    logoKey: z.string().nullable().default(null),
    /** Short line shown in the strip above the header. Empty hides the strip. */
    announcement: z.string().default("Every piece is one of a kind · New arrivals weekly"),
  }),
  shop: z.object({
    currency: z.string().length(3).default("USD"),
    locale: z.string().default("en-US"),
    /** Dates and times in the admin portal are shown in this time zone (Tampa is US Eastern). */
    timeZone: z.string().default("America/New_York"),
  }),
  /** Items put "on hold" for a customer. */
  holds: z.object({
    /** A hold ends by itself after this many hours and the item becomes available again. */
    expiryHours: z.number().int().min(1).max(24 * 30).default(72),
    autoExpire: z.boolean().default(true),
  }),
  contact: z.object({
    email: z.string().default(""),
    phone: z.string().default(""),
    location: z.string().default(""),
  }),
  whatsapp: z.object({
    /** Digits only, international format without "+". Empty means not configured. */
    number: z.string().regex(/^\d*$/).default(""),
    productMessage: z
      .string()
      .default("Hi! I'm interested in {name} (ID: {code}). Is it still available?"),
    generalMessage: z.string().default("Hi! I have a question about Pre-Loved Wardrobe."),
  }),
  /** The floating chat button shown on every public page. */
  chat_widget: z.object({
    enabled: z.boolean().default(true),
    title: z.string().default("Chat with us"),
    greeting: z
      .string()
      .default(
        "Hello! Have a question about a piece, sizing or pickup? Send us a message on WhatsApp and we'll reply as soon as we can.",
      ),
    /** Which bottom corner the button sits in. */
    position: z.enum(["right", "left"]).default("right"),
  }),
  /** The AI sales assistant in the chat. Its facts come only from inventory and approved knowledge. */
  ai_assistant: z.object({
    enabled: z.boolean().default(true),
    name: z.string().default("Skyra"),
    greeting: z
      .string()
      .default(
        "Assalam o Alaikum! I'm Skyra. May I know your name? And are you looking for something specific today, or just browsing?",
      ),
    /** Extra guidance from the owner about tone or emphasis. Never a source of facts. */
    instructions: z.string().default(""),
    handoffMessage: z
      .string()
      .default("I've let the owner know. For the quickest reply you can also message us directly on WhatsApp."),
    /** Where owner notifications are emailed. Empty means they are only recorded. */
    notifyEmail: z.string().default(""),
    /** Ceiling on customer messages answered per day across the whole site, to cap AI cost. */
    dailyMessageLimit: z.number().int().min(0).max(100000).default(500),
  }),
  social: z.object({
    instagram: z.string().default(""),
    facebook: z.string().default(""),
    tiktok: z.string().default(""),
  }),
  seo: z.object({
    description: z
      .string()
      .default(
        "Pre-loved Indian and Pakistani clothing: shalwar kameez, kurtas, lehengas, sarees, anarkalis, menswear and accessories.",
      ),
  }),
  homepage: z.object({
    heroEyebrow: z.string().default("Pre-loved Indian & Pakistani wear"),
    heroTitle: z.string().default("Loved once. Ready to be loved again."),
    heroText: z
      .string()
      .default(
        "From everyday kurtas to wedding lehengas — a hand-picked collection of pre-owned outfits, each one checked, photographed and described honestly.",
      ),
    heroImageKey: z.string().nullable().default(null),
    aboutTitle: z.string().default("How it works"),
    steps: z
      .array(z.object({ title: z.string(), text: z.string() }))
      .default([
        { title: "Browse", text: "Every outfit is one of a kind. When it's gone, it's gone." },
        { title: "Ask", text: "Message us on WhatsApp about the piece you like." },
        { title: "Wear", text: "We arrange payment and handover with you directly." },
      ]),
  }),
} as const;

export type SettingsKey = keyof typeof settingsSchemas;

export type SiteSettings = {
  [K in SettingsKey]: z.infer<(typeof settingsSchemas)[K]>;
};

export const SETTINGS_KEYS = Object.keys(settingsSchemas) as SettingsKey[];

/** Build a complete settings object from whatever is stored; bad or missing values fall back to defaults. */
export function parseSettings(stored: Partial<Record<string, unknown>>): SiteSettings {
  const out: Record<string, unknown> = {};
  for (const key of SETTINGS_KEYS) {
    const schema = settingsSchemas[key];
    const parsed = schema.safeParse(stored[key] ?? {});
    out[key] = parsed.success ? parsed.data : schema.parse({});
  }
  return out as SiteSettings;
}
