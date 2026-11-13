"use server";

import { refresh, updateTag } from "next/cache";
import { requireAdmin } from "@/server/auth/session";
import {
  createCategory,
  moveCategory,
  renameCategory,
  setCategoryActive,
  setCategoryParent,
} from "@/server/services/admin-categories";
import type { AdminUser } from "@/server/services/admin-auth";
import { AdminActionError } from "@/server/services/admin-products";
import { CACHE_TAGS } from "@/server/services/cached";

export type CategoryResult = { error?: string };

async function run(task: (admin: AdminUser) => Promise<unknown>): Promise<CategoryResult> {
  const admin = await requireAdmin();
  try {
    await task(admin);
  } catch (error) {
    if (error instanceof AdminActionError) return { error: error.message };
    throw error;
  }
  updateTag(CACHE_TAGS.categories);
  refresh();
  return {};
}

const str = (value: unknown) => (typeof value === "string" ? value.slice(0, 200) : "");

export async function createCategoryAction(name: string, parentId: string | null): Promise<CategoryResult> {
  return run((admin) => createCategory(admin, { name: str(name), parentId: parentId ? str(parentId) : null }));
}

export async function renameCategoryAction(id: string, name: string): Promise<CategoryResult> {
  return run((admin) => renameCategory(admin, str(id), str(name)));
}

export async function setCategoryActiveAction(id: string, isActive: boolean): Promise<CategoryResult> {
  return run((admin) => setCategoryActive(admin, str(id), isActive === true));
}

export async function moveCategoryAction(id: string, direction: "up" | "down"): Promise<CategoryResult> {
  return run((admin) => moveCategory(admin, str(id), direction === "up" ? "up" : "down"));
}

export async function setCategoryParentAction(id: string, parentId: string | null): Promise<CategoryResult> {
  return run((admin) => setCategoryParent(admin, str(id), parentId ? str(parentId) : null));
}
