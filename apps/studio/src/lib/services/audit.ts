import { newId } from "@tcm/shared";
import { auditEvents, type DbOrTx } from "@tcm/db";
import { db } from "../db";

export interface AuditInput {
  organizationId: string;
  actorUserId?: string | null;
  actorType?: "user" | "system" | "api_key";
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

export async function recordAudit(input: AuditInput, tx: DbOrTx = db()): Promise<void> {
  await tx.insert(auditEvents).values({
    id: newId("audit"),
    organizationId: input.organizationId,
    actorUserId: input.actorUserId ?? null,
    actorType: input.actorType ?? "user",
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    metadata: input.metadata ?? {},
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
  });
}
