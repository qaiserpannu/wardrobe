import "server-only";
import { desc, eq } from "drizzle-orm";
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
