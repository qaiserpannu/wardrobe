import "server-only";
import { desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { adminUsers, auditLog } from "@/server/db/schema";

export type AuditEntryInput = {
  adminUserId: string | null;
  action: string;
  summary: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
};

export type AuditEntry = {
  id: string;
  action: string;
  summary: string;
  adminName: string | null;
  createdAt: Date;
};

/** Adds one line to the record of changes. Never include passwords or other secrets in details. */
export async function recordAudit(entry: AuditEntryInput): Promise<void> {
  await getDb().insert(auditLog).values(entry);
}

export async function listRecentAudit(limit = 10): Promise<AuditEntry[]> {
  return getDb()
    .select({
      id: auditLog.id,
      action: auditLog.action,
      summary: auditLog.summary,
      adminName: adminUsers.name,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(adminUsers, eq(auditLog.adminUserId, adminUsers.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}

/** Groups of record entries the owner can filter by. */
export const AUDIT_AREAS = {
  items: { label: "Items", prefixes: ["product."] },
  categories: { label: "Categories", prefixes: ["category."] },
  settings: { label: "Settings", prefixes: ["settings."] },
  inbox: { label: "Inbox", prefixes: ["inbox."] },
  assistant: { label: "Assistant", prefixes: ["knowledge."] },
  signin: { label: "Sign-in", prefixes: ["auth.", "admin."] },
} as const;
export type AuditArea = keyof typeof AUDIT_AREAS;

export const AUDIT_PAGE_SIZE = 40;

export async function listAudit(filter: { area?: AuditArea; page?: number }): Promise<{ items: AuditEntry[]; total: number; page: number; pageCount: number }> {
  const db = getDb();
  const where: SQL | undefined = filter.area ? or(...AUDIT_AREAS[filter.area].prefixes.map((p) => like(auditLog.action, `${p}%`))) : undefined;
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(auditLog).where(where);
  const pageCount = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(filter.page ?? 1) || 1), pageCount);
  const items = await db
    .select({ id: auditLog.id, action: auditLog.action, summary: auditLog.summary, adminName: adminUsers.name, createdAt: auditLog.createdAt })
    .from(auditLog)
    .leftJoin(adminUsers, eq(auditLog.adminUserId, adminUsers.id))
    .where(where)
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(AUDIT_PAGE_SIZE)
    .offset((page - 1) * AUDIT_PAGE_SIZE);
  return { items, total, page, pageCount };
}
