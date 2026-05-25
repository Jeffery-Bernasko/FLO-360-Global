import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  auditLog,
  stockMovements,
  users,
  type StockMovement,
} from "@/db/schema";
import { log } from "@/audit";
import { recordMovement } from "@/lib/stock-ledger";
import { ADJUSTMENT_REASONS } from "@/lib/adjustments-shared";
import { DEFAULT_PRODUCT_ID } from "@/lib/default-product";

export { ADJUSTMENT_REASONS, type AdjustmentReason } from "@/lib/adjustments-shared";

export class AdjustmentError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AdjustmentError";
    this.code = code;
  }
}

type Actor = { id: string; role: "worker" | "manager" };

const reasonSet: ReadonlySet<string> = new Set(ADJUSTMENT_REASONS);

const inputSchema = z.object({
  boxesDelta: z.coerce
    .number({ invalid_type_error: "Boxes must be a number." })
    .int("Boxes must be a whole number.")
    .refine((n) => n !== 0, "Boxes cannot be zero."),
  reason: z.string().refine((s) => reasonSet.has(s), "Pick a valid reason."),
  note: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type RecordAdjustmentInput = {
  actor: Actor;
  boxesDelta: number | string;
  reason: string;
  note?: string | null;
};

export type RecordAdjustmentResult = {
  movementId: bigint;
  resultingStock: number;
};

/**
 * Manager-only manual stock adjustment. Goes straight into stock_movements
 * with kind='adjustment' and reason=<category>. The free-text note (if any)
 * is stored in the audit log payload rather than on the ledger row — keeps
 * the ledger lean.
 *
 * Negative adjustments must not drive current stock below zero; this is
 * checked inside the transaction.
 */
export async function recordAdjustment(
  input: RecordAdjustmentInput,
): Promise<RecordAdjustmentResult> {
  if (input.actor.role !== "manager") {
    throw new AdjustmentError(
      "forbidden",
      "Only managers can record adjustments.",
    );
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    throw new AdjustmentError(
      "invalid",
      parsed.error.issues[0]?.message ?? "Invalid input.",
    );
  }

  return db.transaction(async (tx) => {
    const [stockRow] = await tx
      .select({
        total: sql<string>`COALESCE(SUM(boxes_delta), 0)`.as("total"),
      })
      .from(stockMovements);
    const currentStock = Number(stockRow?.total ?? 0);

    if (parsed.data.boxesDelta < 0 && currentStock + parsed.data.boxesDelta < 0) {
      throw new AdjustmentError(
        "would_go_negative",
        `Only ${currentStock} boxes in stock — cannot subtract ${Math.abs(parsed.data.boxesDelta)}.`,
      );
    }

    // TODO(Phase 4): replace DEFAULT_PRODUCT_ID with user-selected product.
    const { id } = await recordMovement(
      {
        kind: "adjustment",
        boxesDelta: parsed.data.boxesDelta,
        reason: parsed.data.reason,
        productId: DEFAULT_PRODUCT_ID,
        actor: { id: input.actor.id },
      },
      tx,
    );

    await log(
      {
        actorUserId: input.actor.id,
        action: "adjustment.create",
        entityType: "stock_movement",
        entityId: String(id),
        payload: {
          boxesDelta: parsed.data.boxesDelta,
          reason: parsed.data.reason,
          note: parsed.data.note,
          resultingStock: currentStock + parsed.data.boxesDelta,
        },
      },
      tx,
    );

    return {
      movementId: id,
      resultingStock: currentStock + parsed.data.boxesDelta,
    };
  });
}

// ---------- read helpers ----------

export type AdjustmentRow = StockMovement & {
  actorName: string | null;
  /** Free-text note pulled from the matching adjustment.create audit row. */
  note: string | null;
};

/**
 * Lists adjustments, newest first. Joins the stock_movements row to its
 * actor (users) and to the matching audit_log.payload.note so the list
 * view can show context.
 */
export async function listAdjustments(limit = 100): Promise<AdjustmentRow[]> {
  const rows = await db
    .select({
      id: stockMovements.id,
      kind: stockMovements.kind,
      boxesDelta: stockMovements.boxesDelta,
      reason: stockMovements.reason,
      sourceFormKind: stockMovements.sourceFormKind,
      sourceFormId: stockMovements.sourceFormId,
      createdBy: stockMovements.createdBy,
      createdAt: stockMovements.createdAt,
      actorName: users.name,
      note: sql<
        string | null
      >`(SELECT (${auditLog.payload}->>'note') FROM ${auditLog} WHERE ${auditLog.entityType} = 'stock_movement' AND ${auditLog.entityId} = ${stockMovements.id}::text AND ${auditLog.action} = 'adjustment.create' LIMIT 1)`,
    })
    .from(stockMovements)
    .leftJoin(users, eq(users.id, stockMovements.createdBy))
    .where(eq(stockMovements.kind, "adjustment"))
    .orderBy(desc(stockMovements.createdAt))
    .limit(limit);
  return rows as AdjustmentRow[];
}

/**
 * Used by the list page so we don't need a separate query.
 */
export async function getAdjustmentsAndCurrentStock(): Promise<{
  rows: AdjustmentRow[];
  currentStock: number;
}> {
  const [rows, stockRow] = await Promise.all([
    listAdjustments(),
    db
      .select({
        total: sql<string>`COALESCE(SUM(boxes_delta), 0)`.as("total"),
      })
      .from(stockMovements)
      .then((r) => r[0]),
  ]);
  return { rows, currentStock: Number(stockRow?.total ?? 0) };
}
