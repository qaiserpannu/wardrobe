import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseCatalogParams } from "@/lib/catalog-params";
import { parseSectionForm, SETTINGS_SECTIONS, sectionFormValues, toInternationalNumber } from "@/lib/settings-form";
import { parseSettings } from "@/lib/settings";
import { closeDb, getDb } from "@/server/db/client";
import { auditLog, categories, siteSettings } from "@/server/db/schema";
import { type AdminUser, createAdmin } from "@/server/services/admin-auth";
import {
  createCategory,
  listAdminCategories,
  listGroupOptions,
  moveCategory,
  renameCategory,
  setCategoryActive,
  setCategoryParent,
} from "@/server/services/admin-categories";
import { AdminActionError, listCategoryOptions } from "@/server/services/admin-products";
import { saveSettingsSection, setHeroImage } from "@/server/services/admin-settings";
import { listCategoryTree } from "@/server/services/categories";
import { getProductBySlug, listProducts } from "@/server/services/products";
import { getSettings } from "@/server/services/settings";

let admin: AdminUser;
let settingsBefore: { key: string; value: unknown }[];
const createdCategoryIds: string[] = [];
const unique = (prefix: string) => `${prefix} ${randomUUID().slice(0, 6)}`;

async function add(name: string, parentId: string | null) {
  const id = await createCategory(admin, { name, parentId });
  createdCategoryIds.push(id);
  return id;
}

const section = (id: string) => SETTINGS_SECTIONS.find((s) => s.id === id)!;
/** The form as it would be submitted with some boxes changed. */
async function submit(id: string, changes: Record<string, string | undefined>) {
  const current = sectionFormValues(section(id), await getSettings());
  const raw: Record<string, string> = {};
  for (const [name, value] of Object.entries(current)) {
    if (typeof value === "boolean") {
      if (value) raw[name] = "on";
    } else raw[name] = value;
  }
  for (const [path, value] of Object.entries(changes)) {
    if (value === undefined) delete raw[`${id}__${path}`];
    else raw[`${id}__${path}`] = value;
  }
  return saveSettingsSection(admin, id, raw);
}

beforeAll(async () => {
  admin = await createAdmin({ email: `settings-${randomUUID()}@test.invalid`, name: "Settings Tester", password: "a-long-test-password-1" });
  settingsBefore = await getDb().select({ key: siteSettings.key, value: siteSettings.value }).from(siteSettings);
});

// Put everything back so other test files still see the sample data.
afterAll(async () => {
  const db = getDb();
  await db.delete(siteSettings);
  if (settingsBefore.length > 0) await db.insert(siteSettings).values(settingsBefore);
  // Children before groups.
  for (const id of createdCategoryIds.reverse()) await db.delete(categories).where(eq(categories.id, id));
  await closeDb();
});

describe("settings", () => {
  it("adds the US country code to a 10-digit WhatsApp number", () => {
    expect(toInternationalNumber("813 990 7900")).toBe("18139907900");
    expect(toInternationalNumber("(813) 990-7900")).toBe("18139907900");
    expect(toInternationalNumber("+1 813 990 7900")).toBe("18139907900");
    expect(toInternationalNumber("+92 300 1234567")).toBe("923001234567");
  });

  it("saves a change, takes effect at once, and records it", async () => {
    const result = await submit("whatsapp", { number: "813-555-0142" });
    expect(result).toEqual({ ok: true, changed: ["WhatsApp number"] });
    expect((await getSettings()).whatsapp.number).toBe("18135550142");
    const entries = await getDb().select().from(auditLog).where(eq(auditLog.adminUserId, admin.id));
    expect(entries.some((e) => e.action === "settings.update" && e.summary.includes("WhatsApp number"))).toBe(true);
  });

  it("an empty WhatsApp number is allowed and switches the buttons off", async () => {
    expect((await submit("whatsapp", { number: "" })).ok).toBe(true);
    expect((await getSettings()).whatsapp.number).toBe("");
  });

  it("refuses bad values and changes nothing", async () => {
    const before = await getSettings();
    const bad: [string, Record<string, string>][] = [
      ["whatsapp", { number: "call me maybe" }],
      ["whatsapp", { number: "12345" }],
      ["whatsapp", { productMessage: "" }],
      ["branding", { siteName: "" }],
      ["branding", { siteName: "x".repeat(61) }],
      ["contact", { email: "not-an-email" }],
      ["social", { instagram: "javascript:alert(1)" }],
      ["social", { facebook: "not a link" }],
      ["chat", { position: "top" }],
      ["holds", { expiryHours: "0" }],
      ["holds", { expiryHours: "three days" }],
      ["holds", { expiryHours: "100000" }],
      ["homepage", { "steps.1.title": "" }],
    ];
    for (const [id, changes] of bad) {
      const result = await submit(id, changes);
      expect(result.ok, `${id} ${JSON.stringify(changes)}`).toBe(false);
    }
    expect(await getSettings()).toEqual(before);
    expect((await saveSettingsSection(admin, "nonsense", {})).ok).toBe(false);
  });

  it("tidies links, and switches read as off when unticked", async () => {
    await submit("social", { instagram: "instagram.com/prelovedbyskyra" });
    expect((await getSettings()).social.instagram).toBe("https://instagram.com/prelovedbyskyra");
    await submit("chat", { enabled: undefined });
    expect((await getSettings()).chat_widget.enabled).toBe(false);
    await submit("chat", { enabled: "on" });
    expect((await getSettings()).chat_widget.enabled).toBe(true);
  });

  it("keeps values the form does not show, such as the homepage picture and the assistant's settings", async () => {
    const before = await getSettings();
    await submit("homepage", { heroTitle: "A new headline", "steps.2.text": "Collect in Tampa." });
    const after = await getSettings();
    expect(after.homepage.heroTitle).toBe("A new headline");
    expect(after.homepage.steps[2]).toEqual({ title: before.homepage.steps[2].title, text: "Collect in Tampa." });
    expect(after.homepage.steps.slice(0, 2)).toEqual(before.homepage.steps.slice(0, 2));
    expect(after.homepage.heroImageKey).toBe(before.homepage.heroImageKey);
    expect(after.ai_assistant).toEqual(before.ai_assistant);
  });

  it("changes the usual hold length", async () => {
    await submit("holds", { expiryHours: "48" });
    expect((await getSettings()).holds).toEqual({ expiryHours: 48, autoExpire: true });
    await submit("holds", { expiryHours: "72" });
  });

  it("ignores boxes that are not part of the section", () => {
    const result = parseSectionForm(section("branding"), { branding__siteName: "Shop", branding__logoKey: "../../etc/passwd", ai_assistant__enabled: "" }, parseSettings({}));
    expect(result.ok && (result.value as { logoKey: unknown }).logoKey).toBeNull();
  });

  it("replaces the homepage picture, checking it like any photo", async () => {
    const picture = await sharp({ create: { width: 1000, height: 1250, channels: 3, background: "#7a1e2c" } }).jpeg().toBuffer();
    await setHeroImage(admin, picture);
    expect((await getSettings()).homepage.heroImageKey).toMatch(/^site\/hero-[0-9a-f]{16}\.webp$/);
    await expect(setHeroImage(admin, Buffer.from("<svg></svg>"))).rejects.toThrow();
  });
});

describe("categories", () => {
  it("adds a group and a category inside it, in last place, with a web address", async () => {
    const groupName = unique("Kids Test");
    const groupId = await add(groupName, null);
    const childId = await add(unique("Frocks Test"), groupId);
    const tree = await listAdminCategories();
    const group = tree.at(-1)!;
    expect(group).toMatchObject({ id: groupId, name: groupName, isActive: true, itemCount: 0 });
    expect(group.slug).toMatch(/^kids-test-/);
    expect(group.children.map((c) => c.id)).toEqual([childId]);
    // Items can be put in the new category, not in the group.
    const options = (await listCategoryOptions()).map((o) => o.id);
    expect(options).toContain(childId);
    expect(options).not.toContain(groupId);
  });

  it("refuses duplicate, empty and overlong names", async () => {
    await expect(add("sarees", null)).rejects.toThrow(/already/);
    await expect(add(" ", null)).rejects.toBeInstanceOf(AdminActionError);
    await expect(add("x".repeat(41), null)).rejects.toBeInstanceOf(AdminActionError);
  });

  it("keeps two levels only, and keeps items out of groups", async () => {
    const tree = await listAdminCategories();
    const women = tree.find((g) => g.name === "Women")!;
    const sarees = women.children.find((c) => c.name === "Sarees")!;
    const men = tree.find((g) => g.name === "Men")!;
    await expect(add(unique("Third Level"), sarees.id)).rejects.toThrow(/top-level/);
    await expect(setCategoryParent(admin, women.id, men.id)).rejects.toThrow(/contains other categories/);
    await expect(setCategoryParent(admin, sarees.id, sarees.id)).rejects.toBeInstanceOf(AdminActionError);
    // A top-level category that has items directly in it cannot take categories.
    const withItems = tree.find((g) => g.children.length === 0 && g.itemCount > 0);
    if (withItems) {
      await expect(add(unique("Inside"), withItems.id)).rejects.toThrow(/items directly/);
      expect((await listGroupOptions()).map((g) => g.id)).not.toContain(withItems.id);
    }
  });

  it("renames without changing the web address, so old links keep working", async () => {
    const id = await add(unique("Old Name"), null);
    const [before] = await getDb().select().from(categories).where(eq(categories.id, id));
    const renamed = unique("New Name");
    await renameCategory(admin, id, `  ${renamed}  `);
    const [after] = await getDb().select().from(categories).where(eq(categories.id, id));
    expect(after).toMatchObject({ name: renamed, slug: before.slug });
    await expect(renameCategory(admin, id, "Women")).rejects.toThrow(/already/);
  });

  it("reorders within a group, and the shop's menu follows", async () => {
    const order = async () => (await listCategoryTree()).find((g) => g.name === "Women")!.children.map((c) => c.name);
    const before = await order();
    const women = (await listAdminCategories()).find((g) => g.name === "Women")!;
    const second = women.children[1];
    await moveCategory(admin, second.id, "up");
    expect(await order()).toEqual([before[1], before[0], ...before.slice(2)]);
    await moveCategory(admin, second.id, "up"); // already first: nothing happens
    expect((await order())[0]).toBe(before[1]);
    await moveCategory(admin, second.id, "down");
    expect(await order()).toEqual(before);
  });

  it("moves a category to another group and back", async () => {
    const tree = await listAdminCategories();
    const women = tree.find((g) => g.name === "Women")!;
    const men = tree.find((g) => g.name === "Men")!;
    const dupattas = women.children.find((c) => c.name === "Dupattas")!;
    const originalOrder = women.children.map((c) => c.id);
    await setCategoryParent(admin, dupattas.id, men.id);
    expect((await listCategoryTree()).find((g) => g.name === "Men")!.children.map((c) => c.name)).toContain("Dupattas");
    await setCategoryParent(admin, dupattas.id, women.id);
    // Restore the sample order for the other tests.
    await getDb().transaction(async (tx) => {
      for (const [i, id] of originalOrder.entries()) await tx.update(categories).set({ sortOrder: i }).where(eq(categories.id, id));
    });
    expect((await listAdminCategories()).find((g) => g.name === "Women")!.children.map((c) => c.id)).toEqual(originalOrder);
  });

  it("hiding a category takes it and its items off the website; showing brings them back", async () => {
    const sarees = (await listAdminCategories()).flatMap((g) => g.children).find((c) => c.name === "Sarees")!;
    const before = await listProducts(parseCatalogParams({ category: "sarees" }), 50);
    expect(before.total).toBeGreaterThan(0);
    const slug = before.items[0].slug;

    await setCategoryActive(admin, sarees.id, false);
    expect((await listProducts(parseCatalogParams({ category: "sarees" }), 50)).total).toBe(0);
    expect(await getProductBySlug(slug)).toBeNull();
    expect((await listCategoryTree()).flatMap((g) => g.children).map((c) => c.name)).not.toContain("Sarees");
    // Still there for the owner.
    expect((await listAdminCategories()).flatMap((g) => g.children).find((c) => c.id === sarees.id)).toMatchObject({ isActive: false, itemCount: sarees.itemCount });

    await setCategoryActive(admin, sarees.id, true);
    expect((await listProducts(parseCatalogParams({ category: "sarees" }), 50)).total).toBe(before.total);
  });

  it("records category changes", async () => {
    const entries = await getDb()
      .select({ action: auditLog.action })
      .from(auditLog)
      .where(inArray(auditLog.action, ["category.create", "category.rename", "category.hide", "category.show", "category.move", "category.reorder"]));
    expect(new Set(entries.map((e) => e.action)).size).toBe(6);
  });
});
