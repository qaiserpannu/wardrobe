import { z } from "zod";

/**
 * Site settings are stored in the database as one JSON document per key.
 * Every field has a default, so the site works before anything is configured.
 * The admin portal (Milestone 5) will edit these.
 */
export const settingsSchemas = {
  branding: z.object({
    siteName: z.string().default("Pre-Loved Wardrobe"),
    tagline: z.string().default("Pre-owned fashion, chosen with care."),
    logoKey: z.string().nullable().default(null),
  }),
  shop: z.object({
    currency: z.string().length(3).default("USD"),
    locale: z.string().default("en-US"),
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
  social: z.object({
    instagram: z.string().default(""),
    facebook: z.string().default(""),
    tiktok: z.string().default(""),
  }),
  seo: z.object({
    description: z
      .string()
      .default(
        "Shop carefully selected pre-owned clothing. Browse dresses, shirts, jeans, jackets and more.",
      ),
  }),
  homepage: z.object({
    heroEyebrow: z.string().default("New arrivals weekly"),
    heroTitle: z.string().default("Loved once. Ready to be loved again."),
    heroText: z
      .string()
      .default(
        "A small, hand-picked collection of pre-owned pieces. Every item is checked, photographed and described honestly.",
      ),
    heroImageKey: z.string().nullable().default(null),
    aboutTitle: z.string().default("How it works"),
    steps: z
      .array(z.object({ title: z.string(), text: z.string() }))
      .default([
        { title: "Browse", text: "Every piece is one of a kind. When it's gone, it's gone." },
        { title: "Ask", text: "Message us on WhatsApp about the item you like." },
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
