import { asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  inboundForms,
  inboundFormLines,
  products,
  suppliers,
  type InboundForm,
  type InboundFormLine,
  type Supplier,
} from "@/db/schema";
import { log } from "@/audit";
import { recordMovement } from "@/lib/stock-ledger";

export class InboundFormError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "InboundFormError";
    this.code = code;
  }
}

type Actor = { id: string; role: "worker" | "manager" };

const lineItemSchema = z.object({
  productId: z.string().uuid("Pick a product."),
  boxes: z.coerce
    .number({ invalid_type_error: "Boxes must be a number." })
    .int("Boxes must be a whole number.")
    .positive("Boxes must be greater than zero."),
});

const submitSchema = z.object({
  supplierId: z.string().uuid("Pick a supplier."),
  lines: z
    .array(lineItemSchema)
    .min(1, "At least one product line is required."),
  receivedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Received date is required."),
  note: z.string().trim().max(2000).optional().nullable(),
  attachmentKey: z.string().optional().nullable(),
});

export type LineItemInput = {
  productId: string;
  boxes: number | string;
};

export type SubmitInboundInput = {
  actor: Actor;
  supplierId: string;
  lines: LineItemInput[];
  receivedDate: string;
  note?: string | null;
  attachmentKey?: string | null;
};

function parseSubmit(input: SubmitInboundInput) {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    throw new InboundFormError("invalid", parsed.error.issues[0]?.message ?? "Invalid form input.");
  }
  // Check for duplicate products
  const productIds = parsed.data.lines.map((l) => l.productId);
  if (new Set(productIds).size !== productIds.length) {
    throw new InboundFormError("invalid", "Each product can only appear once per form.");
  }
  return parsed.data;
}

async function validateProducts(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  productIds: string[],
): Promise<void> {
  const rows = await tx
    .select({ id: products.id, isActive: products.isActive })
    .from(products)
    .where(inArray(products.id, productIds))
    .limit(productIds.length);
  const productsById = new Map(rows.map((row) => [row.id, row]));

  for (const productId of productIds) {
    const product = productsById.get(productId);
    if (!product || !product.isActive) {
      throw new InboundFormError("invalid_product", "Product not found or inactive.");
    }
  }
}

export async function submitInbound(input: SubmitInboundInput): Promise<InboundForm> {
  const data = parseSubmit(input);
  const totalBoxes = data.lines.reduce((sum, l) => sum + l.boxes, 0);

  return db.transaction(async (tx) => {
    // Verify supplier exists and is active.
    const supplierRows = await tx
      .select({ id: suppliers.id, isActive: suppliers.isActive })
      .from(suppliers)
      .where(eq(suppliers.id, data.supplierId))
      .limit(1);
    if (supplierRows.length === 0 || !supplierRows[0].isActive) {
      throw new InboundFormError("invalid_supplier", "Supplier not found or inactive.");
    }

    // Verify all products exist and are active.
    await validateProducts(
      tx,
      data.lines.map((line) => line.productId),
    );

    const [created] = await tx
      .insert(inboundForms)
      .values({
        supplierId: data.supplierId,
        boxes: totalBoxes,
        receivedDate: data.receivedDate,
        note: data.note ?? null,
        attachmentKey: data.attachmentKey ?? null,
        status: "pending",
        createdBy: input.actor.id,
      })
      .returning();

    // Insert line items.
    await tx.insert(inboundFormLines).values(
      data.lines.map((line) => ({
        formId: created.id,
        productId: line.productId,
        boxes: line.boxes,
      })),
    );

    await log(
      {
        actorUserId: input.actor.id,
        action: "form.submit",
        entityType: "inbound_form",
        entityId: String(created.id),
        payload: {
          supplierId: created.supplierId,
          boxes: totalBoxes,
          receivedDate: created.receivedDate,
          lines: data.lines,
        },
      },
      tx,
    );

    return created;
  });
}

export type EditAndResubmitInput = {
  actor: Actor;
  formId: bigint;
  supplierId: string;
  lines: LineItemInput[];
  receivedDate: string;
  note?: string | null;
  /** When provided, replaces the existing key. When `null`, clears it. When `undefined`, leaves as-is. */
  attachmentKey?: string | null;
};

export async function editAndResubmitInbound(
  input: EditAndResubmitInput,
): Promise<InboundForm> {
  const data = parseSubmit({
    actor: input.actor,
    supplierId: input.supplierId,
    lines: input.lines,
    receivedDate: input.receivedDate,
    note: input.note,
    attachmentKey: input.attachmentKey ?? undefined,
  });
  const totalBoxes = data.lines.reduce((sum, l) => sum + l.boxes, 0);

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(inboundForms)
      .where(eq(inboundForms.id, input.formId))
      .limit(1);

    if (!existing) throw new InboundFormError("not_found", "Form not found.");
    if (existing.createdBy !== input.actor.id) {
      throw new InboundFormError("forbidden", "Only the form's creator can edit it.");
    }
    if (existing.status !== "rejected") {
      throw new InboundFormError(
        "not_editable",
        "Only rejected forms can be edited and resubmitted.",
      );
    }

    const supplierRows = await tx
      .select({ id: suppliers.id, isActive: suppliers.isActive })
      .from(suppliers)
      .where(eq(suppliers.id, data.supplierId))
      .limit(1);
    if (supplierRows.length === 0 || !supplierRows[0].isActive) {
      throw new InboundFormError("invalid_supplier", "Supplier not found or inactive.");
    }

    await validateProducts(
      tx,
      data.lines.map((line) => line.productId),
    );

    const [updated] = await tx
      .update(inboundForms)
      .set({
        supplierId: data.supplierId,
        boxes: totalBoxes,
        receivedDate: data.receivedDate,
        note: data.note ?? null,
        attachmentKey:
          input.attachmentKey === undefined
            ? existing.attachmentKey
            : data.attachmentKey ?? null,
        status: "pending",
        decisionReason: null,
        decidedBy: null,
        decidedAt: null,
      })
      .where(eq(inboundForms.id, input.formId))
      .returning();

    // Replace all line items.
    await tx
      .delete(inboundFormLines)
      .where(eq(inboundFormLines.formId, input.formId));
    await tx.insert(inboundFormLines).values(
      data.lines.map((line) => ({
        formId: input.formId,
        productId: line.productId,
        boxes: line.boxes,
      })),
    );

    await log(
      {
        actorUserId: input.actor.id,
        action: "form.edit_and_resubmit",
        entityType: "inbound_form",
        entityId: String(input.formId),
        payload: {
          before: {
            supplierId: existing.supplierId,
            boxes: existing.boxes,
            receivedDate: existing.receivedDate,
          },
          after: {
            supplierId: updated.supplierId,
            boxes: totalBoxes,
            receivedDate: updated.receivedDate,
            lines: data.lines,
          },
        },
      },
      tx,
    );

    return updated;
  });
}

export type ApproveInput = {
  actor: Actor;
  formId: bigint;
};

export async function approveInbound(input: ApproveInput): Promise<InboundForm> {
  if (input.actor.role !== "manager") {
    throw new InboundFormError("forbidden", "Only managers can approve.");
  }

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(inboundForms)
      .where(eq(inboundForms.id, input.formId))
      .for("update")
      .limit(1);

    if (!existing) throw new InboundFormError("not_found", "Form not found.");
    if (existing.status !== "pending") {
      throw new InboundFormError(
        "not_pending",
        `Form is already ${existing.status}.`,
      );
    }

    // Load line items for this form.
    const lines = await tx
      .select()
      .from(inboundFormLines)
      .where(eq(inboundFormLines.formId, input.formId));

    const [updated] = await tx
      .update(inboundForms)
      .set({
        status: "approved",
        decidedBy: input.actor.id,
        decidedAt: new Date(),
        decisionReason: null,
      })
      .where(eq(inboundForms.id, input.formId))
      .returning();

    // Record one stock movement per line item.
    for (const line of lines) {
      await recordMovement(
        {
          kind: "inbound",
          boxesDelta: line.boxes,
          reason: existing.note ?? `Inbound form #${existing.id}`,
          sourceFormKind: "inbound",
          sourceFormId: existing.id,
          productId: line.productId,
          actor: { id: input.actor.id },
        },
        tx,
      );
    }

    await log(
      {
        actorUserId: input.actor.id,
        action: "form.approve",
        entityType: "inbound_form",
        entityId: String(input.formId),
        payload: {
          boxes: existing.boxes,
          supplierId: existing.supplierId,
          lines: lines.map((l) => ({
            productId: l.productId,
            boxes: l.boxes,
          })),
        },
      },
      tx,
    );

    return updated;
  });
}

export type RejectInput = {
  actor: Actor;
  formId: bigint;
  reason: string;
};

export async function rejectInbound(input: RejectInput): Promise<InboundForm> {
  if (input.actor.role !== "manager") {
    throw new InboundFormError("forbidden", "Only managers can reject.");
  }
  const reason = input.reason.trim();
  if (!reason) {
    throw new InboundFormError("invalid", "A reason is required to reject.");
  }

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(inboundForms)
      .where(eq(inboundForms.id, input.formId))
      .for("update")
      .limit(1);

    if (!existing) throw new InboundFormError("not_found", "Form not found.");
    if (existing.status !== "pending") {
      throw new InboundFormError(
        "not_pending",
        `Form is already ${existing.status}.`,
      );
    }

    const [updated] = await tx
      .update(inboundForms)
      .set({
        status: "rejected",
        decisionReason: reason,
        decidedBy: input.actor.id,
        decidedAt: new Date(),
      })
      .where(eq(inboundForms.id, input.formId))
      .returning();

    await log(
      {
        actorUserId: input.actor.id,
        action: "form.reject",
        entityType: "inbound_form",
        entityId: String(input.formId),
        payload: { reason },
      },
      tx,
    );

    return updated;
  });
}

// ---------- read helpers ----------

export type InboundFormLineWithProduct = InboundFormLine & {
  productName: string;
};

export type InboundFormRow = InboundForm & {
  supplierName: string;
};

const formWithSupplierColumns = {
  id: inboundForms.id,
  supplierId: inboundForms.supplierId,
  boxes: inboundForms.boxes,
  receivedDate: inboundForms.receivedDate,
  note: inboundForms.note,
  attachmentKey: inboundForms.attachmentKey,
  status: inboundForms.status,
  decisionReason: inboundForms.decisionReason,
  createdBy: inboundForms.createdBy,
  decidedBy: inboundForms.decidedBy,
  decidedAt: inboundForms.decidedAt,
  createdAt: inboundForms.createdAt,
  updatedAt: inboundForms.updatedAt,
  supplierName: suppliers.name,
} as const;

export async function listMyInboundForms(actorId: string): Promise<InboundFormRow[]> {
  const rows = await db
    .select(formWithSupplierColumns)
    .from(inboundForms)
    .leftJoin(suppliers, eq(inboundForms.supplierId, suppliers.id))
    .where(eq(inboundForms.createdBy, actorId))
    .orderBy(desc(inboundForms.createdAt))
    .limit(100);
  return rows.map((r) => ({ ...r, supplierName: r.supplierName ?? "(unknown)" })) as InboundFormRow[];
}

export async function listPendingInboundForms(): Promise<InboundFormRow[]> {
  const rows = await db
    .select(formWithSupplierColumns)
    .from(inboundForms)
    .leftJoin(suppliers, eq(inboundForms.supplierId, suppliers.id))
    .where(eq(inboundForms.status, "pending"))
    .orderBy(asc(inboundForms.createdAt))
    .limit(100);
  return rows.map((r) => ({ ...r, supplierName: r.supplierName ?? "(unknown)" })) as InboundFormRow[];
}

export async function getInboundForm(
  formId: bigint,
): Promise<(InboundFormRow & { supplier: Supplier | null; lines: InboundFormLineWithProduct[] }) | null> {
  const rows = await db
    .select({
      form: inboundForms,
      supplier: suppliers,
    })
    .from(inboundForms)
    .leftJoin(suppliers, eq(inboundForms.supplierId, suppliers.id))
    .where(eq(inboundForms.id, formId))
    .limit(1);
  if (rows.length === 0) return null;
  const r = rows[0];

  // Load line items with product names.
  const lines = await db
    .select({
      id: inboundFormLines.id,
      formId: inboundFormLines.formId,
      productId: inboundFormLines.productId,
      boxes: inboundFormLines.boxes,
      productName: products.name,
    })
    .from(inboundFormLines)
    .innerJoin(products, eq(inboundFormLines.productId, products.id))
    .where(eq(inboundFormLines.formId, formId));

  return {
    ...r.form,
    supplierName: r.supplier?.name ?? "(unknown)",
    supplier: r.supplier,
    lines: lines.map((l) => ({
      id: l.id,
      formId: l.formId,
      productId: l.productId,
      boxes: l.boxes,
      productName: l.productName,
    })),
  };
}

export async function countPendingInboundForms(): Promise<number> {
  const rows = await db
    .select({ id: inboundForms.id })
    .from(inboundForms)
    .where(eq(inboundForms.status, "pending"));
  return rows.length;
}
