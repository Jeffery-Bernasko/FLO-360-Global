import { db } from "@/db";
import { auditLog, type NewAuditLogEntry } from "@/db/schema";
import type { Database } from "@/db";

export type AuditPayload = Record<string, unknown>;
type AuditWriter = Pick<Database, "insert">;

export type LogInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  payload?: AuditPayload;
  actorUserId?: string | null;
};

/**
 * Append-only audit log writer. Every meaningful mutating action in the app
 * should emit one entry through this function. Pass an optional Drizzle
 * transaction `tx` so the audit row commits or rolls back with the action
 * it describes.
 */
export async function log(
  input: LogInput,
  tx?: AuditWriter,
): Promise<void> {
  const row: NewAuditLogEntry = {
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    payload: input.payload ?? {},
    actorUserId: input.actorUserId ?? null,
  };
  await (tx ?? db).insert(auditLog).values(row);
}
