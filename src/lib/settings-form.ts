import { normalizeWhatsAppNumber } from "@/integrations/whatsapp";
import { type SettingsKey, settingsSchemas, type SiteSettings } from "./settings";

/**
 * The settings screens in the admin portal, described as data: which boxes
 * each section shows and how each box is checked. The same description
 * draws the form and validates what comes back.
 */

export type SettingsField = {
  /** Where the value lives inside the section's settings, e.g. "siteName" or "steps.0.title". */
  path: string;
  label: string;
  kind: "text" | "textarea" | "toggle" | "select" | "number" | "url" | "email" | "whatsapp";
  hint?: string;
  maxLength?: number;
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
};

export type SettingsSection = {
  id: string;
  key: SettingsKey;
  title: string;
  intro?: string;
  fields: SettingsField[];
};

const text = (path: string, label: string, maxLength: number, extra: Partial<SettingsField> = {}): SettingsField => ({
  path,
  label,
  kind: "text",
  maxLength,
  ...extra,
});
const area = (path: string, label: string, maxLength: number, extra: Partial<SettingsField> = {}): SettingsField => ({
  path,
  label,
  kind: "textarea",
  maxLength,
  ...extra,
});

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "whatsapp",
    key: "whatsapp",
    title: "WhatsApp",
    intro: "The number customers reach when they tap a WhatsApp button, and the message that is filled in for them.",
    fields: [
      {
        path: "number",
        label: "WhatsApp number",
        kind: "whatsapp",
        hint: "A 10-digit US number is fine; the country code 1 is added for you. Leave empty to hide the WhatsApp buttons.",
      },
      area("productMessage", "Message when asking about an item", 300, {
        required: true,
        hint: "{name} and {code} are replaced with the item's name and product ID.",
      }),
      area("generalMessage", "Message for a general question", 300, { required: true }),
    ],
  },
  {
    id: "branding",
    key: "branding",
    title: "Shop name and header",
    fields: [
      text("siteName", "Shop name", 60, { required: true }),
      text("byline", "Small line under the name", 40, { hint: "Leave empty to hide it." }),
      text("tagline", "Tagline", 120, { hint: "Shown in the browser tab and the footer." }),
      text("announcement", "Strip above the header", 120, { hint: "Leave empty to hide the strip." }),
    ],
  },
  {
    id: "homepage",
    key: "homepage",
    title: "Homepage text",
    fields: [
      text("heroEyebrow", "Small line above the headline", 80),
      text("heroTitle", "Headline", 100, { required: true }),
      area("heroText", "Text under the headline", 400),
      text("aboutTitle", "“How it works” heading", 60, { required: true }),
      text("steps.0.title", "Step 1 title", 40, { required: true }),
      area("steps.0.text", "Step 1 text", 200, { required: true }),
      text("steps.1.title", "Step 2 title", 40, { required: true }),
      area("steps.1.text", "Step 2 text", 200, { required: true }),
      text("steps.2.title", "Step 3 title", 40, { required: true }),
      area("steps.2.text", "Step 3 text", 200, { required: true }),
    ],
  },
  {
    id: "contact",
    key: "contact",
    title: "Contact details",
    intro: "Shown in the footer. Leave a box empty to hide that line.",
    fields: [
      { path: "email", label: "Email", kind: "email", maxLength: 200 },
      text("phone", "Phone", 30),
      text("location", "Location", 120, { hint: "For example: Tampa, Florida. Pickup by arrangement." }),
    ],
  },
  {
    id: "social",
    key: "social",
    title: "Social links",
    intro: "Paste the full address of each page. Leave empty to hide the icon.",
    fields: [
      { path: "instagram", label: "Instagram", kind: "url", maxLength: 300 },
      { path: "facebook", label: "Facebook", kind: "url", maxLength: 300 },
      { path: "tiktok", label: "TikTok", kind: "url", maxLength: 300 },
    ],
  },
  {
    id: "chat",
    key: "chat_widget",
    title: "Chat button",
    intro: "The round button in the corner of every page. When the assistant is switched off, it opens this WhatsApp panel instead.",
    fields: [
      { path: "enabled", label: "Show the chat button", kind: "toggle" },
      text("title", "Panel title", 60, { required: true }),
      area("greeting", "Greeting in the WhatsApp panel", 400, { required: true }),
      {
        path: "position",
        label: "Corner",
        kind: "select",
        options: [
          { value: "right", label: "Bottom right" },
          { value: "left", label: "Bottom left" },
        ],
      },
    ],
  },
  {
    id: "holds",
    key: "holds",
    title: "Holds",
    fields: [
      {
        path: "expiryHours",
        label: "Usual hold length, in hours",
        kind: "number",
        min: 1,
        max: 720,
        required: true,
        hint: "72 hours is 3 days. You can still choose a different length for any single hold.",
      },
      {
        path: "autoExpire",
        label: "End holds automatically",
        kind: "toggle",
        hint: "When on, an item goes back to available by itself once its hold runs out.",
      },
    ],
  },
  {
    id: "seo",
    key: "seo",
    title: "Search engines",
    fields: [
      area("description", "Shop description", 300, {
        required: true,
        hint: "One or two sentences. Shown under the shop's name in Google results and when the site is shared.",
      }),
    ],
  },
];

export const fieldName = (section: SettingsSection, field: SettingsField) => `${section.id}__${field.path}`;

function getPath(source: unknown, path: string): unknown {
  let current: unknown = source;
  for (const part of path.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let current: Record<string, unknown> | unknown[] = target;
  for (const [index, part] of parts.entries()) {
    const container = current as Record<string, unknown>;
    if (index === parts.length - 1) {
      container[part] = value;
      return;
    }
    if (container[part] === null || typeof container[part] !== "object") container[part] = /^\d+$/.test(parts[index + 1]) ? [] : {};
    current = container[part] as Record<string, unknown>;
  }
}

/** Current values as the form shows them: strings, and true/false for switches. */
export function sectionFormValues(section: SettingsSection, settings: SiteSettings): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const field of section.fields) {
    const value = getPath(settings[section.key], field.path);
    out[fieldName(section, field)] = field.kind === "toggle" ? value === true : value === null || value === undefined ? "" : String(value);
  }
  return out;
}

/** "8139907900" -> "18139907900". Other lengths are taken as already including a country code. */
export function toInternationalNumber(input: string): string {
  const digits = normalizeWhatsAppNumber(input);
  return digits.length === 10 ? `1${digits}` : digits;
}

function parseField(field: SettingsField, raw: string | undefined): { value: unknown } | { error: string } {
  if (field.kind === "toggle") return { value: raw === "on" };
  const value = (raw ?? "").trim();
  if (field.required && value === "") return { error: "This cannot be empty." };
  if (field.maxLength && value.length > field.maxLength) return { error: `Use at most ${field.maxLength} characters.` };

  switch (field.kind) {
    case "number": {
      const n = Number(value);
      if (!/^\d+$/.test(value) || n < (field.min ?? 0) || n > (field.max ?? Number.MAX_SAFE_INTEGER)) {
        return { error: `Enter a whole number from ${field.min ?? 0} to ${field.max}.` };
      }
      return { value: n };
    }
    case "select":
      return field.options?.some((o) => o.value === value) ? { value } : { error: "Choose one of the options." };
    case "email":
      return value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? { value } : { error: "That does not look like an email address." };
    case "url": {
      if (value === "") return { value };
      const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      try {
        const url = new URL(withScheme);
        if (!url.hostname.includes(".")) throw new Error("no domain");
        return { value: url.toString() };
      } catch {
        return { error: "Paste the full address, for example https://instagram.com/yourshop" };
      }
    }
    case "whatsapp": {
      if (value === "") return { value: "" };
      if (/[^\d\s()+.-]/.test(value)) return { error: "Use digits only, for example 813 990 7900." };
      const number = toInternationalNumber(value);
      return number.length >= 8 && number.length <= 15 ? { value: number } : { error: "That number is too short or too long." };
    }
    default:
      return { value };
  }
}

export type SectionParseResult =
  | { ok: true; value: SiteSettings[SettingsKey]; changed: string[] }
  | { ok: false; errors: Record<string, string> };

/**
 * Checks one submitted section and returns the complete new value for its
 * settings key. Anything the form does not show (stored image names, for
 * example) is carried over from the current value untouched.
 */
export function parseSectionForm(section: SettingsSection, raw: Record<string, string>, settings: SiteSettings): SectionParseResult {
  const next = structuredClone(settings[section.key]) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const changed: string[] = [];
  for (const field of section.fields) {
    const name = fieldName(section, field);
    const parsed = parseField(field, raw[name]);
    if ("error" in parsed) {
      errors[name] = parsed.error;
      continue;
    }
    if (getPath(next, field.path) !== parsed.value) changed.push(field.label);
    setPath(next, field.path, parsed.value);
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const checked = settingsSchemas[section.key].safeParse(next);
  if (!checked.success) return { ok: false, errors: { [fieldName(section, section.fields[0])]: "These values could not be saved." } };
  return { ok: true, value: checked.data, changed };
}
