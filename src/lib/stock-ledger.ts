import { and, asc, gte, lte, sql } from "drizzle-orm";
import { db, type Database } from "@/db";
import {
  stockMovements,
  type MovementKind,
  type SourceFormKind,
  type StockMovement,
} from "@/db/schema";
import { log } from "@/audit";

export class StockLedgerError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "StockLedgerError";
    this.code = code;
  }
}

/**
 * The minimal Drizzle surface the ledger needs. Both the top-level `db` and a
 * Drizzle transaction satisfy this shape, so callers can compose ledger writes
 * inside a larger transaction (e.g. F6 outbound approval).
 */
export type LedgerClient = Pick<Database, "insert" | "select">;

export type RecordMovementInput = {
  kind: MovementKind;
  /** Signed integer. Inbound > 0, outbound < 0, adjustment non-zero. */
  boxesDelta: number;
  reason?: string | null;
  sourceFormKind?: SourceFormKind | null;
  sourceFormId?: bigint | null;
  actor: { id: string };
};

export type RecordMovementResult = { id: bigint };

export type GetMovementsInput = {
  from: Date;
  to: Date;
  /** Hard cap on rows returned. Defaults to 200. */
  limit?: number;
};

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

function validateInput(input: RecordMovementInput): void {
  if (!Number.isInteger(input.boxesDelta)) {
    throw new StockLedgerError(
      "invalid_delta",
      "boxesDelta must be an integer.",
    );
  }
  if (input.boxesDelta === 0) {
    throw new StockLedgerError(
      "invalid_delta",
      "boxesDelta cannot be zero.",
    );
  }
  if (input.kind === "inbound" && input.boxesDelta <= 0) {
    throw new StockLedgerError(
      "invalid_delta_for_kind",
      "Inbound movements require a positive boxesDelta.",
    );
  }
  if (input.kind === "outbound" && input.boxesDelta >= 0) {
    throw new StockLedgerError(
      "invalid_delta_for_kind",
      "Outbound movements require a negative boxesDelta.",
    );
  }
  // adjustments accept any non-zero delta

  const hasSourceKind = input.sourceFormKind != null;
  const hasSourceId = input.sourceFormId != null;
  if (hasSourceKind !== hasSourceId) {
    throw new StockLedgerError(
      "incomplete_source",
      "sourceFormKind and sourceFormId must be set together or both omitted.",
    );
  }
  if (input.kind === "adjustment" && hasSourceKind) {
    throw new StockLedgerError(
      "adjustment_with_source",
      "Adjustment movements must not reference a source form.",
    );
  }
  if (hasSourceKind && input.sourceFormKind !== input.kind) {
    throw new StockLedgerError(
      "mismatched_source",
      `sourceFormKind '${input.sourceFormKind}' does not match movement kind '${input.kind}'.`,
    );
  }
}

/**
 * Append a single row to the ledger. The only supported write operation —
 * the module exposes no update or delete by design (master PRD: stock history
 * is tamper-evident).
 */
export async function recordMovement(
  input: RecordMovementInput,
  tx?: LedgerClient,
): Promise<RecordMovementResult> {
  validateInput(input);
  const client = tx ?? db;

  const [created] = await client
    .insert(stockMovements)
    .values({
      kind: input.kind,
      boxesDelta: input.boxesDelta,
      reason: input.reason ?? null,
      sourceFormKind: input.sourceFormKind ?? null,
      sourceFormId: input.sourceFormId ?? null,
      createdBy: input.actor.id,
    })
    .returning({ id: stockMovements.id });

  await log(
    {
      actorUserId: input.actor.id,
      action: "ledger.write",
      entityType: "stock_movement",
      entityId: String(created.id),
      payload: {
        kind: input.kind,
        boxesDelta: input.boxesDelta,
        reason: input.reason ?? null,
        sourceFormKind: input.sourceFormKind ?? null,
        sourceFormId:
          input.sourceFormId != null ? String(input.sourceFormId) : null,
      },
    },
    tx,
  );

  return { id: created.id };
}

/**
 * Returns the integer current stock = SUM(boxes_delta).
 * Pass `tx` to read a transaction-consistent snapshot inside a larger flow.
 */
export async function getCurrentStock(tx?: LedgerClient): Promise<number> {
  const client = tx ?? db;
  const rows = await client
    .select({
      total: sql<string>`COALESCE(SUM(${stockMovements.boxesDelta}), 0)`.as(
        "total",
      ),
    })
    .from(stockMovements);
  return Number(rows[0]?.total ?? 0);
}

/**
 * Returns movements with `created_at` in the inclusive [from, to] window,
 * ordered chronologically. Capped at `limit` (default 200, max 1000).
 */
export async function getMovements(
  input: GetMovementsInput,
  tx?: LedgerClient,
): Promise<StockMovement[]> {
  if (
    Number.isNaN(input.from.getTime()) ||
    Number.isNaN(input.to.getTime()) ||
    input.from > input.to
  ) {
    throw new StockLedgerError(
      "invalid_range",
      "`from` and `to` must be valid dates, and `from` must be before or equal to `to`.",
    );
  }
  const requestedLimit =
    input.limit != null && Number.isInteger(input.limit)
      ? input.limit
      : DEFAULT_LIMIT;
  const cap = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT);
  const client = tx ?? db;

  return client
    .select()
    .from(stockMovements)
    .where(
      and(
        gte(stockMovements.createdAt, input.from),
        lte(stockMovements.createdAt, input.to),
      ),
    )
    .orderBy(asc(stockMovements.createdAt), asc(stockMovements.id))
    .limit(cap);
}
