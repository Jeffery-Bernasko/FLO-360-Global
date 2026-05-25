import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  customers,
  inboundForms,
  inboundFormLines,
  outboundForms,
  outboundFormLines,
  products,
  stockMovements,
  suppliers,
  users,
  type MovementKind,
} from "@/db/schema";

export class ReportError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ReportError";
    this.code = code;
  }
}

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const DEFAULT_DAYS = 30;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type DateRange = {
  from: Date;
  to: Date;
};

export type ReportFilter = DateRange & {
  /** Optional movement-kind filter for the stock-movement report. */
  kinds?: MovementKind[];
  /** Optional product filter for the stock-movement report. */
  productId?: string;
};

export type ReportKindFilter = MovementKind | "all";

export function validateRange({ from, to }: DateRange): void {
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new ReportError("invalid_range", "Pick valid from/to dates.");
  }
  if (from > to) {
    throw new ReportError(
      "invalid_range",
      "`from` must be before or equal to `to`.",
    );
  }
  if (to.getTime() - from.getTime() > ONE_YEAR_MS) {
    throw new ReportError(
      "range_too_large",
      "Date range cannot exceed one year.",
    );
  }
}

/**
 * Default date range used by the report pages when none is provided: the
 * last 30 days, inclusive.
 */
export function defaultRange(now: Date = new Date()): DateRange {
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  const from = new Date(now);
  from.setDate(from.getDate() - DEFAULT_DAYS);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export function dateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseDateInput(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export function endOfDateInput(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export function parseReportParams(
  searchParams: URLSearchParams,
  now: Date = new Date(),
): ReportFilter & { kind: ReportKindFilter } {
  const fallback = defaultRange(now);
  const from = parseDateInput(searchParams.get("from"), fallback.from);
  const to = endOfDateInput(searchParams.get("to"), fallback.to);
  const rawKind = searchParams.get("kind");
  const kind: ReportKindFilter =
    rawKind === "inbound" || rawKind === "outbound" || rawKind === "adjustment"
      ? rawKind
      : "all";
  const rawProductId = searchParams.get("productId");
  if (rawProductId && !UUID_PATTERN.test(rawProductId)) {
    throw new ReportError("invalid_product", "Pick a valid product.");
  }
  const productId = rawProductId ?? undefined;
  return {
    from,
    to,
    kind,
    kinds: kind === "all" ? undefined : [kind],
    productId,
  };
}

export function reportSearchParams(range: DateRange, kind?: ReportKindFilter, productId?: string) {
  const params = new URLSearchParams({
    from: dateInputValue(range.from),
    to: dateInputValue(range.to),
  });
  if (kind && kind !== "all") params.set("kind", kind);
  if (productId) params.set("productId", productId);
  return params;
}

export function reportFilename(prefix: string, range: DateRange, ext: string) {
  return `${prefix}_${dateInputValue(range.from)}_${dateInputValue(range.to)}.${ext}`;
}

// ---------- Stock Movement Report ----------

export type StockMovementRow = {
  id: string;
  createdAt: Date;
  kind: MovementKind;
  /** Signed integer */
  boxesDelta: number;
  reason: string | null;
  sourceFormKind: "inbound" | "outbound" | null;
  sourceFormId: string | null;
  /** Product name. */
  productName: string | null;
  /** Counterparty name (supplier for inbound, customer for outbound, null for adjustment). */
  partyName: string | null;
  /** Outbound only — unit price in pesewas. */
  unitPricePesewas: number | null;
  /** Outbound only — total in pesewas. */
  totalPesewas: number | null;
  /** Who recorded (or whose form is the source). */
  actorName: string | null;
  /** Running balance up to and including this row, given the chosen window. */
  runningBalance: number;
};

export async function stockMovementReport(
  filter: ReportFilter,
): Promise<StockMovementRow[]> {
  validateRange(filter);

  const conditions = [
    gte(stockMovements.createdAt, filter.from),
    lte(stockMovements.createdAt, filter.to),
  ];
  if (filter.kinds && filter.kinds.length > 0 && filter.kinds.length < 3) {
    conditions.push(inArray(stockMovements.kind, filter.kinds));
  }
  if (filter.productId) {
    conditions.push(eq(stockMovements.productId, filter.productId));
  }

  // Pull raw movements, joined to the actor and product; then enrich with
  // party + price by looking up the source form in a second step.
  const rows = await db
    .select({
      id: stockMovements.id,
      createdAt: stockMovements.createdAt,
      kind: stockMovements.kind,
      boxesDelta: stockMovements.boxesDelta,
      reason: stockMovements.reason,
      sourceFormKind: stockMovements.sourceFormKind,
      sourceFormId: stockMovements.sourceFormId,
      productId: stockMovements.productId,
      actorName: users.name,
      productName: products.name,
    })
    .from(stockMovements)
    .leftJoin(users, eq(users.id, stockMovements.createdBy))
    .leftJoin(products, eq(products.id, stockMovements.productId))
    .where(and(...conditions))
    .orderBy(asc(stockMovements.createdAt), asc(stockMovements.id));

  // Bucket the inbound vs outbound source ids so we can do exactly two lookups.
  const inboundIds = rows
    .filter((r) => r.sourceFormKind === "inbound" && r.sourceFormId != null)
    .map((r) => r.sourceFormId!) as bigint[];
  const outboundIds = rows
    .filter((r) => r.sourceFormKind === "outbound" && r.sourceFormId != null)
    .map((r) => r.sourceFormId!) as bigint[];

  const [inboundRows, outboundRows] = await Promise.all([
    inboundIds.length > 0
      ? db
          .select({
            id: inboundForms.id,
            supplierName: suppliers.name,
          })
          .from(inboundForms)
          .leftJoin(suppliers, eq(suppliers.id, inboundForms.supplierId))
          .where(inArray(inboundForms.id, inboundIds))
      : Promise.resolve([] as { id: bigint; supplierName: string | null }[]),
    outboundIds.length > 0
      ? db
          .select({
            id: outboundForms.id,
            customerName: customers.name,
          })
          .from(outboundForms)
          .leftJoin(customers, eq(customers.id, outboundForms.customerId))
          .where(inArray(outboundForms.id, outboundIds))
      : Promise.resolve(
          [] as {
            id: bigint;
            customerName: string | null;
          }[],
        ),
  ]);

  // Load outbound line items for unit price data.
  const outboundLineRows =
    outboundIds.length > 0
      ? await db
          .select({
            formId: outboundFormLines.formId,
            productId: outboundFormLines.productId,
            unitPricePesewas: outboundFormLines.unitPricePesewas,
            boxes: outboundFormLines.boxes,
          })
          .from(outboundFormLines)
          .where(inArray(outboundFormLines.formId, outboundIds))
      : [];

  const inboundById = new Map(inboundRows.map((r) => [String(r.id), r]));
  const outboundById = new Map(outboundRows.map((r) => [String(r.id), r]));
  // Key: "formId:productId"
  const outboundLineMap = new Map(
    outboundLineRows.map((l) => [`${l.formId}:${l.productId}`, l]),
  );

  let runningBalance = 0;
  const enriched: StockMovementRow[] = rows.map((r) => {
    runningBalance += r.boxesDelta;

    let partyName: string | null = null;
    let unitPricePesewas: number | null = null;
    let totalPesewas: number | null = null;

    if (r.sourceFormKind === "inbound" && r.sourceFormId != null) {
      partyName =
        inboundById.get(String(r.sourceFormId))?.supplierName ?? null;
    } else if (r.sourceFormKind === "outbound" && r.sourceFormId != null) {
      const o = outboundById.get(String(r.sourceFormId));
      partyName = o?.customerName ?? null;
      const line = outboundLineMap.get(`${r.sourceFormId}:${r.productId}`);
      unitPricePesewas = line?.unitPricePesewas ?? null;
      totalPesewas = line ? line.boxes * line.unitPricePesewas : null;
    }

    return {
      id: String(r.id),
      createdAt: r.createdAt,
      kind: r.kind,
      boxesDelta: r.boxesDelta,
      reason: r.reason,
      sourceFormKind: r.sourceFormKind,
      sourceFormId: r.sourceFormId != null ? String(r.sourceFormId) : null,
      productName: r.productName,
      partyName,
      unitPricePesewas,
      totalPesewas,
      actorName: r.actorName,
      runningBalance,
    };
  });

  return enriched;
}

// ---------- Per-Customer Report ----------

export type PerCustomerRow = {
  customerId: string;
  customerName: string;
  customerLocation: string | null;
  totalBoxes: number;
  totalPesewas: number;
  dispatchCount: number;
  lastDispatchAt: Date | null;
};

export async function perCustomerReport(
  range: DateRange,
): Promise<PerCustomerRow[]> {
  validateRange(range);

  const rows = await db
    .select({
      customerId: customers.id,
      customerName: customers.name,
      customerLocation: customers.location,
      totalBoxes: sql<string>`COALESCE(SUM(${outboundFormLines.boxes}), 0)`.as(
        "total_boxes",
      ),
      totalPesewas:
        sql<string>`COALESCE(SUM(${outboundFormLines.boxes} * ${outboundFormLines.unitPricePesewas}), 0)`.as(
          "total_pesewas",
        ),
      dispatchCount: sql<string>`COUNT(DISTINCT ${outboundForms.id})`.as(
        "dispatch_count",
      ),
      lastDispatchAt: sql<Date | null>`MAX(${outboundForms.decidedAt})`.as(
        "last_dispatch_at",
      ),
    })
    .from(outboundForms)
    .innerJoin(customers, eq(customers.id, outboundForms.customerId))
    .innerJoin(outboundFormLines, eq(outboundFormLines.formId, outboundForms.id))
    .where(
      and(
        eq(outboundForms.status, "approved"),
        gte(outboundForms.decidedAt, range.from),
        lte(outboundForms.decidedAt, range.to),
      ),
    )
    .groupBy(customers.id, customers.name, customers.location)
    .orderBy(desc(sql`total_boxes`));

  return rows.map((r) => ({
    customerId: r.customerId,
    customerName: r.customerName,
    customerLocation: r.customerLocation,
    totalBoxes: Number(r.totalBoxes),
    totalPesewas: Number(r.totalPesewas),
    dispatchCount: Number(r.dispatchCount),
    lastDispatchAt: r.lastDispatchAt ? new Date(r.lastDispatchAt) : null,
  }));
}

// ---------- Per-Supplier Report ----------

export type PerSupplierRow = {
  supplierId: string;
  supplierName: string;
  country: string | null;
  totalBoxes: number;
  shipmentCount: number;
  lastReceivedAt: Date | null;
};

export async function perSupplierReport(
  range: DateRange,
): Promise<PerSupplierRow[]> {
  validateRange(range);

  const rows = await db
    .select({
      supplierId: suppliers.id,
      supplierName: suppliers.name,
      country: suppliers.country,
      totalBoxes: sql<string>`COALESCE(SUM(${inboundFormLines.boxes}), 0)`.as(
        "total_boxes",
      ),
      shipmentCount: sql<string>`COUNT(DISTINCT ${inboundForms.id})`.as(
        "shipment_count",
      ),
      lastReceivedAt: sql<Date | null>`MAX(${inboundForms.decidedAt})`.as(
        "last_received_at",
      ),
    })
    .from(inboundForms)
    .innerJoin(suppliers, eq(suppliers.id, inboundForms.supplierId))
    .innerJoin(inboundFormLines, eq(inboundFormLines.formId, inboundForms.id))
    .where(
      and(
        eq(inboundForms.status, "approved"),
        gte(inboundForms.decidedAt, range.from),
        lte(inboundForms.decidedAt, range.to),
      ),
    )
    .groupBy(suppliers.id, suppliers.name, suppliers.country)
    .orderBy(desc(sql`total_boxes`));

  return rows.map((r) => ({
    supplierId: r.supplierId,
    supplierName: r.supplierName,
    country: r.country,
    totalBoxes: Number(r.totalBoxes),
    shipmentCount: Number(r.shipmentCount),
    lastReceivedAt: r.lastReceivedAt ? new Date(r.lastReceivedAt) : null,
  }));
}
