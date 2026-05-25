import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { put } from "@vercel/blob";
import { db } from "@/db";
import {
  customers,
  outboundForms,
  type Customer,
  type OutboundForm,
} from "@/db/schema";
import { log } from "@/audit";
import { recordMovement, getCurrentStock } from "@/lib/stock-ledger";
import { renderInvoicePdfBuffer, type InvoiceData } from "@/lib/invoice-pdf";
import { DEFAULT_PRODUCT_ID } from "@/lib/default-product";

export class OutboundFormError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "OutboundFormError";
    this.code = code;
  }
}

type Actor = { id: string; role: "worker" | "manager" };

const submitSchema = z.object({
  customerId: z.string().uuid("Pick a customer."),
  boxes: z.coerce
    .number({ invalid_type_error: "Boxes must be a number." })
    .int("Boxes must be a whole number.")
    .positive("Boxes must be greater than zero."),
  unitPricePesewas: z.coerce
    .number({ invalid_type_error: "Unit price must be a number." })
    .int("Unit price must be a whole number of pesewas.")
    .positive("Unit price must be greater than zero."),
  dispatchDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Dispatch date is required."),
  note: z.string().trim().max(2000).optional().nullable(),
});

export type SubmitOutboundInput = {
  actor: Actor;
  customerId: string;
  boxes: number | string;
  unitPricePesewas: number | string;
  dispatchDate: string;
  note?: string | null;
};

function parseSubmit(input: SubmitOutboundInput) {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    throw new OutboundFormError(
      "invalid",
      parsed.error.issues[0]?.message ?? "Invalid form input.",
    );
  }
  return parsed.data;
}

/**
 * Lightweight check used by the form UI to disable submission when the
 * requested boxes exceed current stock. The authoritative check happens
 * inside the approval transaction.
 */
export async function quoteOutbound({ boxes }: { boxes: number }): Promise<{
  currentStock: number;
  ok: boolean;
}> {
  const currentStock = await getCurrentStock();
  return { currentStock, ok: boxes > 0 && boxes <= currentStock };
}

export async function submitOutbound(input: SubmitOutboundInput): Promise<OutboundForm> {
  const data = parseSubmit(input);

  return db.transaction(async (tx) => {
    const customerRows = await tx
      .select({ id: customers.id, isActive: customers.isActive })
      .from(customers)
      .where(eq(customers.id, data.customerId))
      .limit(1);
    if (customerRows.length === 0 || !customerRows[0].isActive) {
      throw new OutboundFormError(
        "invalid_customer",
        "Customer not found or inactive.",
      );
    }

    const [stockRow] = await tx
      .select({
        total: sql<string>`COALESCE(SUM(boxes_delta), 0)`.as("total"),
      })
      .from(sql`stock_movements`);
    const currentStock = Number(stockRow?.total ?? 0);
    if (data.boxes > currentStock) {
      throw new OutboundFormError(
        "insufficient_stock",
        `Only ${currentStock} boxes in stock — cannot release ${data.boxes}.`,
      );
    }

    const [created] = await tx
      .insert(outboundForms)
      .values({
        customerId: data.customerId,
        boxes: data.boxes,
        unitPricePesewas: data.unitPricePesewas,
        dispatchDate: data.dispatchDate,
        note: data.note ?? null,
        status: "pending",
        createdBy: input.actor.id,
      })
      .returning();

    await log(
      {
        actorUserId: input.actor.id,
        action: "form.submit",
        entityType: "outbound_form",
        entityId: String(created.id),
        payload: {
          customerId: created.customerId,
          boxes: created.boxes,
          unitPricePesewas: created.unitPricePesewas,
          dispatchDate: created.dispatchDate,
        },
      },
      tx,
    );

    return created;
  });
}

export type EditAndResubmitOutboundInput = {
  actor: Actor;
  formId: bigint;
  customerId: string;
  boxes: number | string;
  unitPricePesewas: number | string;
  dispatchDate: string;
  note?: string | null;
};

export async function editAndResubmitOutbound(
  input: EditAndResubmitOutboundInput,
): Promise<OutboundForm> {
  const data = parseSubmit({
    actor: input.actor,
    customerId: input.customerId,
    boxes: input.boxes,
    unitPricePesewas: input.unitPricePesewas,
    dispatchDate: input.dispatchDate,
    note: input.note,
  });

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(outboundForms)
      .where(eq(outboundForms.id, input.formId))
      .limit(1);

    if (!existing) throw new OutboundFormError("not_found", "Form not found.");
    if (existing.createdBy !== input.actor.id) {
      throw new OutboundFormError(
        "forbidden",
        "Only the form's creator can edit it.",
      );
    }
    if (existing.status !== "rejected") {
      throw new OutboundFormError(
        "not_editable",
        "Only rejected forms can be edited and resubmitted.",
      );
    }

    const customerRows = await tx
      .select({ id: customers.id, isActive: customers.isActive })
      .from(customers)
      .where(eq(customers.id, data.customerId))
      .limit(1);
    if (customerRows.length === 0 || !customerRows[0].isActive) {
      throw new OutboundFormError(
        "invalid_customer",
        "Customer not found or inactive.",
      );
    }

    const [updated] = await tx
      .update(outboundForms)
      .set({
        customerId: data.customerId,
        boxes: data.boxes,
        unitPricePesewas: data.unitPricePesewas,
        dispatchDate: data.dispatchDate,
        note: data.note ?? null,
        status: "pending",
        decisionReason: null,
        decidedBy: null,
        decidedAt: null,
      })
      .where(eq(outboundForms.id, input.formId))
      .returning();

    await log(
      {
        actorUserId: input.actor.id,
        action: "form.edit_and_resubmit",
        entityType: "outbound_form",
        entityId: String(input.formId),
        payload: {
          before: {
            customerId: existing.customerId,
            boxes: existing.boxes,
            unitPricePesewas: existing.unitPricePesewas,
            dispatchDate: existing.dispatchDate,
          },
          after: {
            customerId: updated.customerId,
            boxes: updated.boxes,
            unitPricePesewas: updated.unitPricePesewas,
            dispatchDate: updated.dispatchDate,
          },
        },
      },
      tx,
    );

    return updated;
  });
}

export type ApproveOutboundInput = {
  actor: Actor;
  formId: bigint;
};

function formatInvoiceNumber(seqValue: bigint, year: number): string {
  return `INV-${year}-${String(seqValue).padStart(6, "0")}`;
}

export async function approveOutbound(input: ApproveOutboundInput): Promise<OutboundForm> {
  if (input.actor.role !== "manager") {
    throw new OutboundFormError("forbidden", "Only managers can approve.");
  }

  // Read warehouse identity outside the transaction (env reads are cheap and
  // not part of the atomicity guarantee).
  const warehouseName =
    process.env.WAREHOUSE_NAME?.trim() || "FLO 360 Global";
  const warehouseContact =
    process.env.WAREHOUSE_CONTACT?.trim() || "";

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(outboundForms)
      .where(eq(outboundForms.id, input.formId))
      .for("update")
      .limit(1);

    if (!existing) throw new OutboundFormError("not_found", "Form not found.");
    if (existing.status !== "pending") {
      throw new OutboundFormError(
        "not_pending",
        `Form is already ${existing.status}.`,
      );
    }

    // Re-check current stock inside the transaction — authoritative.
    const [stockRow] = await tx
      .select({
        total: sql<string>`COALESCE(SUM(boxes_delta), 0)`.as("total"),
      })
      .from(sql`stock_movements`);
    const currentStock = Number(stockRow?.total ?? 0);
    if (existing.boxes > currentStock) {
      throw new OutboundFormError(
        "insufficient_stock",
        `Only ${currentStock} boxes in stock — cannot release ${existing.boxes}.`,
      );
    }

    // Claim next invoice number.
    const seqRow = await tx.execute(
      sql<{ nextval: string }>`SELECT nextval('invoice_seq') AS nextval`,
    );
    // drizzle/postgres-js execute returns either an array or {rows: []} shape.
    const raw =
      (Array.isArray(seqRow) ? seqRow[0] : (seqRow as { rows?: unknown[] }).rows?.[0]) ??
      null;
    const nextval = BigInt((raw as { nextval: string | number }).nextval);
    const decidedAt = new Date();
    const invoiceNumber = formatInvoiceNumber(nextval, decidedAt.getFullYear());

    // Load customer for the invoice render.
    const [customer] = await tx
      .select()
      .from(customers)
      .where(eq(customers.id, existing.customerId))
      .limit(1);

    if (!customer) {
      throw new OutboundFormError(
        "invalid_customer",
        "Customer not found.",
      );
    }

    // Deduct stock via the ledger.
    // TODO(Phase 3): replace DEFAULT_PRODUCT_ID with per-line-item products.
    await recordMovement(
      {
        kind: "outbound",
        boxesDelta: -existing.boxes,
        reason: `Outbound form #${existing.id} → ${customer.name}`,
        sourceFormKind: "outbound",
        sourceFormId: existing.id,
        productId: DEFAULT_PRODUCT_ID,
        actor: { id: input.actor.id },
      },
      tx,
    );

    // Render the PDF only when Blob storage is configured. If rendering or upload fails
    // the whole tx rolls back — no stock movement, no claimed invoice
    // number visible on a form (the sequence may still have advanced, which
    // is acceptable). Without Blob, approval still succeeds and the PDF is skipped.
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    let pdfKey: string | null = null;

    if (token) {
      const invoiceData: InvoiceData = {
        invoiceNumber,
        date: decidedAt,
        warehouseName,
        warehouseContact,
        customer: {
          name: customer.name,
          phone: customer.phone,
          location: customer.location,
        },
        lineItem: {
          description: "Sanitary product, 24 pcs/box",
          boxes: existing.boxes,
          unitPricePesewas: existing.unitPricePesewas,
          totalPesewas: existing.boxes * existing.unitPricePesewas,
        },
      };

      const pdfBuffer = await renderInvoicePdfBuffer(invoiceData);
      pdfKey = `invoices/${decidedAt.getFullYear()}/${invoiceNumber}.pdf`;

      await put(pdfKey, pdfBuffer, {
        access: "public",
        contentType: "application/pdf",
        token,
        addRandomSuffix: false,
      });
    }

    const [updated] = await tx
      .update(outboundForms)
      .set({
        status: "approved",
        decidedBy: input.actor.id,
        decidedAt,
        decisionReason: null,
        invoiceNumber: nextval,
        invoicePdfKey: pdfKey,
      })
      .where(eq(outboundForms.id, input.formId))
      .returning();

    await log(
      {
        actorUserId: input.actor.id,
        action: "form.approve",
        entityType: "outbound_form",
        entityId: String(input.formId),
        payload: {
          boxes: existing.boxes,
          customerId: existing.customerId,
          invoiceNumber,
          totalPesewas: existing.boxes * existing.unitPricePesewas,
        },
      },
      tx,
    );

    return updated;
  });
}

export type RejectOutboundInput = {
  actor: Actor;
  formId: bigint;
  reason: string;
};

export async function rejectOutbound(input: RejectOutboundInput): Promise<OutboundForm> {
  if (input.actor.role !== "manager") {
    throw new OutboundFormError("forbidden", "Only managers can reject.");
  }
  const reason = input.reason.trim();
  if (!reason) {
    throw new OutboundFormError("invalid", "A reason is required to reject.");
  }

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(outboundForms)
      .where(eq(outboundForms.id, input.formId))
      .for("update")
      .limit(1);

    if (!existing) throw new OutboundFormError("not_found", "Form not found.");
    if (existing.status !== "pending") {
      throw new OutboundFormError(
        "not_pending",
        `Form is already ${existing.status}.`,
      );
    }

    const [updated] = await tx
      .update(outboundForms)
      .set({
        status: "rejected",
        decisionReason: reason,
        decidedBy: input.actor.id,
        decidedAt: new Date(),
      })
      .where(eq(outboundForms.id, input.formId))
      .returning();

    await log(
      {
        actorUserId: input.actor.id,
        action: "form.reject",
        entityType: "outbound_form",
        entityId: String(input.formId),
        payload: { reason },
      },
      tx,
    );

    return updated;
  });
}

// ---------- read helpers ----------

export type OutboundFormRow = OutboundForm & {
  customerName: string;
};

const formWithCustomerColumns = {
  id: outboundForms.id,
  customerId: outboundForms.customerId,
  boxes: outboundForms.boxes,
  unitPricePesewas: outboundForms.unitPricePesewas,
  totalPesewas: outboundForms.totalPesewas,
  dispatchDate: outboundForms.dispatchDate,
  note: outboundForms.note,
  status: outboundForms.status,
  decisionReason: outboundForms.decisionReason,
  invoiceNumber: outboundForms.invoiceNumber,
  invoicePdfKey: outboundForms.invoicePdfKey,
  createdBy: outboundForms.createdBy,
  decidedBy: outboundForms.decidedBy,
  decidedAt: outboundForms.decidedAt,
  createdAt: outboundForms.createdAt,
  updatedAt: outboundForms.updatedAt,
  customerName: customers.name,
} as const;

export async function listMyOutboundForms(actorId: string): Promise<OutboundFormRow[]> {
  const rows = await db
    .select(formWithCustomerColumns)
    .from(outboundForms)
    .leftJoin(customers, eq(outboundForms.customerId, customers.id))
    .where(eq(outboundForms.createdBy, actorId))
    .orderBy(desc(outboundForms.createdAt))
    .limit(100);
  return rows.map((r) => ({
    ...r,
    customerName: r.customerName ?? "(unknown)",
  })) as OutboundFormRow[];
}

export async function listPendingOutboundForms(): Promise<OutboundFormRow[]> {
  const rows = await db
    .select(formWithCustomerColumns)
    .from(outboundForms)
    .leftJoin(customers, eq(outboundForms.customerId, customers.id))
    .where(eq(outboundForms.status, "pending"))
    .orderBy(asc(outboundForms.createdAt))
    .limit(100);
  return rows.map((r) => ({
    ...r,
    customerName: r.customerName ?? "(unknown)",
  })) as OutboundFormRow[];
}

export async function getOutboundForm(
  formId: bigint,
): Promise<(OutboundFormRow & { customer: Customer | null }) | null> {
  const rows = await db
    .select({ form: outboundForms, customer: customers })
    .from(outboundForms)
    .leftJoin(customers, eq(outboundForms.customerId, customers.id))
    .where(eq(outboundForms.id, formId))
    .limit(1);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    ...r.form,
    customerName: r.customer?.name ?? "(unknown)",
    customer: r.customer,
  };
}

export function formatInvoiceLabel(invoiceNumber: bigint, year: number): string {
  return formatInvoiceNumber(invoiceNumber, year);
}
