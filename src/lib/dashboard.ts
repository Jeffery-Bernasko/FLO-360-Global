import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { inboundForms, outboundForms } from "@/db/schema";
import { getCurrentStock, getStockByProductWithNames } from "@/lib/stock-ledger";

export type PendingCounts = {
  inbound: number;
  outbound: number;
  total: number;
  /** Caller-scoped: pending forms created by the given actor. */
  mine?: number;
};

/**
 * Single round-trip to count pending forms across both tables, optionally
 * filtered to one actor. Used by the manager dashboard (combined inbox) and
 * the worker dashboard ("my pending submissions").
 */
export async function getPendingCounts(opts?: {
  scopedToUserId?: string;
}): Promise<PendingCounts> {
  const inboundWhere = opts?.scopedToUserId
    ? and(
        eq(inboundForms.status, "pending"),
        eq(inboundForms.createdBy, opts.scopedToUserId),
      )
    : eq(inboundForms.status, "pending");
  const outboundWhere = opts?.scopedToUserId
    ? and(
        eq(outboundForms.status, "pending"),
        eq(outboundForms.createdBy, opts.scopedToUserId),
      )
    : eq(outboundForms.status, "pending");

  const [inboundRow, outboundRow] = await Promise.all([
    db
      .select({ c: sql<string>`COUNT(*)`.as("c") })
      .from(inboundForms)
      .where(inboundWhere)
      .then((r) => r[0]),
    db
      .select({ c: sql<string>`COUNT(*)`.as("c") })
      .from(outboundForms)
      .where(outboundWhere)
      .then((r) => r[0]),
  ]);

  const inbound = Number(inboundRow?.c ?? 0);
  const outbound = Number(outboundRow?.c ?? 0);
  return {
    inbound,
    outbound,
    total: inbound + outbound,
    ...(opts?.scopedToUserId ? { mine: inbound + outbound } : {}),
  };
}

export type ProductStockRow = { productId: string; productName: string; total: number };

export type ManagerDashboard = {
  currentStock: number;
  pending: PendingCounts;
  productStocks: ProductStockRow[];
};

export async function getManagerDashboard(): Promise<ManagerDashboard> {
  const [currentStock, pending, productStocks] = await Promise.all([
    getCurrentStock(),
    getPendingCounts(),
    getStockByProductWithNames(),
  ]);
  return { currentStock, pending, productStocks };
}

export type WorkerDashboard = {
  currentStock: number;
  myPending: number;
};

export async function getWorkerDashboard(actorId: string): Promise<WorkerDashboard> {
  const [currentStock, pending] = await Promise.all([
    getCurrentStock(),
    getPendingCounts({ scopedToUserId: actorId }),
  ]);
  return { currentStock, myPending: pending.total };
}
