import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { put } from "@vercel/blob";
import { db } from "@/db";
import {
  customers,
  outboundForms,
  outboundFormLines,
  products,
  type Customer,
  type OutboundForm,
} from "@/db/schema";
import { log } from "@/audit";
import { recordMovement, getStockForProduct } from "@/lib/stock-ledger";
import { renderInvoicePdfBuffer, type InvoiceData } from "@/lib/invoice-pdf";

export class OutboundFormError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "OutboundFormError";
    this.code = code;
  }
}

type Actor = { id: string; role: "worker" | "manager" };

// --- Line item types ---

export type LineItemInput = {
  productId: string;
  boxes: number | string;
  unitPricePesewas: number | string;
};

export type OutboundFormLineWithProduct = {
  id: bigint;
  formId: bigint;
  productId: string;
  boxes: number;
  unitPricePesewas: number;
  productName: string;
};

const lineSchema = z.object({
  productId: z.string().uuid("Pick a product."),
  boxes: z.coerce
    .number({ invalid_type_error: "Boxes must be a number." })
    .int("Boxes must be a whole number.")
    .positive("Boxes must be greater than zero."),
  unitPricePesewas: z.coerce
    .number({ invalid_type_error: "Unit price must be a number." })
    .int("Unit price must be a whole number of pesewas.")
    .positive("Unit price must be greater than zero."),
});

const submitSchema = z.object({
  customerId: z.string().uuid("Pick a customer."),
  lines: z
    .array(lineSchema)
    .min(1, "At least one product line is required."),
  dispatchDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Dispatch date is required."),
  note: z.string().trim().max(2000).optional().nullable(),
});

export type SubmitOutboundInput = {
  actor: Actor;
  customerId: string;
  lines: LineItemInput[];
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
  // Reject duplicate products.
  const ids = parsed.data.lines.map((l) => l.productId);
  if (new Set(ids).size !== ids.length) {
    throw new OutboundFormError(
      "invalid",
      "Each product can only appear once per form.",
    );
  }
  return parsed.data;
}

async function validateProducts(
  tx: typeof db,
  productIds: string[],
): Promise<void> {
  for (const pid of productIds) {
    const rows = await tx
      .select({ id: products.id, isActive: products.isActive })
      .from(products)
      .where(eq(products.id, pid))
      .limit(1);
    if (rows.length === 0 || !rows[0].isActive) {
      throw new OutboundFormError(
        "invalid_product",
        "One or more products are not found or inactive.",
      );
    }
  }
}

export async function submitOutbound(
  input: SubmitOutboundInput,
): Promise<OutboundForm> {
  const data = parseSubmit(input);

  return db.transaction(async (tx) => {
    // Validate customer.
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

    // Validate products.
    await validateProducts(
      tx as unknown as typeof db,
      data.lines.map((l) => l.productId),
    );

    // Check per-product stock.
    for (const line of data.lines) {
      const stock = await getStockForProduct(line.productId, tx);
      if (line.boxes > stock) {
        throw new OutboundFormError(
          "insufficient_stock",
          `Insufficient stock for one or more products.`,
        );
      }
    }

    const totalBoxes = data.lines.reduce((s, l) => s + l.boxes, 0);
    const totalPesewas = data.lines.reduce(
      (s, l) => s + l.boxes * l.unitPricePesewas,
      0,
    );

    const [created] = await tx
      .insert(outboundForms)
      .values({
        customerId: data.customerId,
        boxes: totalBoxes,
        unitPricePesewas: data.lines[0].unitPricePesewas,
        totalPesewas,
        dispatchDate: data.dispatchDate,
        note: data.note ?? null,
        status: "pending",
        createdBy: input.actor.id,
      })
      .returning();

    // Insert line items.
    await tx.insert(outboundFormLines).values(
      data.lines.map((l) => ({
        formId: created.id,
        productId: l.productId,
        boxes: l.boxes,
        unitPricePesewas: l.unitPricePesewas,
      })),
    );

    await log(
      {
        actorUserId: input.actor.id,
        action: "form.submit",
        entityType: "outbound_form",
        entityId: String(created.id),
        payload: {
          customerId: created.customerId,
          totalBoxes,
          totalPesewas,
          dispatchDate: created.dispatchDate,
          lines: data.lines.map((l) => ({
            productId: l.productId,
            boxes: l.boxes,
            unitPricePesewas: l.unitPricePesewas,
          })),
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
  lines: LineItemInput[];
  dispatchDate: string;
  note?: string | null;
};

export async function editAndResubmitOutbound(
  input: EditAndResubmitOutboundInput,
): Promise<OutboundForm> {
  const data = parseSubmit({
    actor: input.actor,
    customerId: input.customerId,
    lines: input.lines,
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

    // Validate customer.
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

    // Validate products.
    await validateProducts(
      tx as unknown as typeof db,
      data.lines.map((l) => l.productId),
    );

    const totalBoxes = data.lines.reduce((s, l) => s + l.boxes, 0);
    const totalPesewas = data.lines.reduce(
      (s, l) => s + l.boxes * l.unitPricePesewas,
      0,
    );

    // Delete old lines.
    await tx
      .delete(outboundFormLines)
      .where(eq(outboundFormLines.formId, input.formId));

    // Insert new lines.
    await tx.insert(outboundFormLines).values(
      data.lines.map((l) => ({
        formId: input.formId,
        productId: l.productId,
        boxes: l.boxes,
        unitPricePesewas: l.unitPricePesewas,
      })),
    );

    const [updated] = await tx
      .update(outboundForms)
      .set({
        customerId: data.customerId,
        boxes: totalBoxes,
        unitPricePesewas: data.lines[0].unitPricePesewas,
        totalPesewas,
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
          lines: data.lines.map((l) => ({
            productId: l.productId,
            boxes: l.boxes,
            unitPricePesewas: l.unitPricePesewas,
          })),
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

    // Load line items.
    const lines = await tx
      .select({
        id: outboundFormLines.id,
        formId: outboundFormLines.formId,
        productId: outboundFormLines.productId,
        boxes: outboundFormLines.boxes,
        unitPricePesewas: outboundFormLines.unitPricePesewas,
        productName: products.name,
      })
      .from(outboundFormLines)
      .innerJoin(products, eq(outboundFormLines.productId, products.id))
      .where(eq(outboundFormLines.formId, input.formId));

    // Check per-product stock inside the transaction.
    for (const line of lines) {
      const stock = await getStockForProduct(line.productId, tx);
      if (line.boxes > stock) {
        throw new OutboundFormError(
          "insufficient_stock",
          `Insufficient stock for ${line.productName} — only ${stock} boxes available.`,
        );
      }
    }

    // Claim next invoice number.
    const seqRow = await tx.execute(
      sql<{ nextval: string }>`SELECT nextval('invoice_seq') AS nextval`,
    );
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

    // Record one stock movement per line.
    for (const line of lines) {
      await recordMovement(
        {
          kind: "outbound",
          boxesDelta: -line.boxes,
          reason: `Outbound form #${existing.id} → ${customer.name}`,
          sourceFormKind: "outbound",
          sourceFormId: existing.id,
          productId: line.productId,
          actor: { id: input.actor.id },
        },
        tx,
      );
    }

    // Render the PDF only when Blob storage is configured.
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    let pdfKey: string | null = null;

    if (token) {
      const totalPesewas = lines.reduce(
        (s, l) => s + l.boxes * l.unitPricePesewas,
        0,
      );

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
        lineItems: lines.map((l) => ({
          productName: l.productName,
          boxes: l.boxes,
          unitPricePesewas: l.unitPricePesewas,
          subtotalPesewas: l.boxes * l.unitPricePesewas,
        })),
        totalPesewas,
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
          customerId: existing.customerId,
          invoiceNumber,
          totalPesewas: existing.totalPesewas,
          lines: lines.map((l) => ({
            productId: l.productId,
            productName: l.productName,
            boxes: l.boxes,
            unitPricePesewas: l.unitPricePesewas,
          })),
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
): Promise<
  | (OutboundFormRow & {
      customer: Customer | null;
      lines: OutboundFormLineWithProduct[];
    })
  | null
> {
  const rows = await db
    .select({ form: outboundForms, customer: customers })
    .from(outboundForms)
    .leftJoin(customers, eq(outboundForms.customerId, customers.id))
    .where(eq(outboundForms.id, formId))
    .limit(1);
  if (rows.length === 0) return null;
  const r = rows[0];

  const lines = await db
    .select({
      id: outboundFormLines.id,
      formId: outboundFormLines.formId,
      productId: outboundFormLines.productId,
      boxes: outboundFormLines.boxes,
      unitPricePesewas: outboundFormLines.unitPricePesewas,
      productName: products.name,
    })
    .from(outboundFormLines)
    .innerJoin(products, eq(outboundFormLines.productId, products.id))
    .where(eq(outboundFormLines.formId, formId));

  return {
    ...r.form,
    customerName: r.customer?.name ?? "(unknown)",
    customer: r.customer,
    lines,
  };
}

export function formatInvoiceLabel(invoiceNumber: bigint, year: number): string {
  return formatInvoiceNumber(invoiceNumber, year);
}
