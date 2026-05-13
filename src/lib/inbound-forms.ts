import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  inboundForms,
  suppliers,
  type InboundForm,
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

const submitSchema = z.object({
  supplierId: z.string().uuid("Pick a supplier."),
  boxes: z.coerce
    .number({ invalid_type_error: "Boxes must be a number." })
    .int("Boxes must be a whole number.")
    .positive("Boxes must be greater than zero."),
  receivedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Received date is required."),
  note: z.string().trim().max(2000).optional().nullable(),
  attachmentKey: z.string().optional().nullable(),
});

export type SubmitInboundInput = {
  actor: Actor;
  supplierId: string;
  boxes: number | string;
  receivedDate: string;
  note?: string | null;
  attachmentKey?: string | null;
};

function parseSubmit(input: SubmitInboundInput) {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    throw new InboundFormError("invalid", parsed.error.issues[0]?.message ?? "Invalid form input.");
  }
  return parsed.data;
}

export async function submitInbound(input: SubmitInboundInput): Promise<InboundForm> {
  const data = parseSubmit(input);

  return db.transaction(async (tx) => {
    // Verify supplier exists and is active before insert (cheaper than relying on FK error UX).
    const supplierRows = await tx
      .select({ id: suppliers.id, isActive: suppliers.isActive })
      .from(suppliers)
      .where(eq(suppliers.id, data.supplierId))
      .limit(1);
    if (supplierRows.length === 0 || !supplierRows[0].isActive) {
      throw new InboundFormError(
        "invalid_supplier",
        "Supplier not found or inactive.",
      );
    }

    const [created] = await tx
      .insert(inboundForms)
      .values({
        supplierId: data.supplierId,
        boxes: data.boxes,
        receivedDate: data.receivedDate,
        note: data.note ?? null,
        attachmentKey: data.attachmentKey ?? null,
        status: "pending",
        createdBy: input.actor.id,
      })
      .returning();

    await log(
      {
        actorUserId: input.actor.id,
        action: "form.submit",
        entityType: "inbound_form",
        entityId: String(created.id),
        payload: {
          supplierId: created.supplierId,
          boxes: created.boxes,
          receivedDate: created.receivedDate,
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
  boxes: number | string;
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
    boxes: input.boxes,
    receivedDate: input.receivedDate,
    note: input.note,
    attachmentKey: input.attachmentKey ?? undefined,
  });

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

    const [updated] = await tx
      .update(inboundForms)
      .set({
        supplierId: data.supplierId,
        boxes: data.boxes,
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
            note: existing.note,
          },
          after: {
            supplierId: updated.supplierId,
            boxes: updated.boxes,
            receivedDate: updated.receivedDate,
            note: updated.note,
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
    // Lock the form row for the duration of the transaction so two managers
    // cannot approve the same pending form concurrently.
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
        status: "approved",
        decidedBy: input.actor.id,
        decidedAt: new Date(),
        decisionReason: null,
      })
      .where(eq(inboundForms.id, input.formId))
      .returning();

    await recordMovement(
      {
        kind: "inbound",
        boxesDelta: existing.boxes,
        reason: existing.note ?? `Inbound form #${existing.id}`,
        sourceFormKind: "inbound",
        sourceFormId: existing.id,
        actor: { id: input.actor.id },
      },
      tx,
    );

    await log(
      {
        actorUserId: input.actor.id,
        action: "form.approve",
        entityType: "inbound_form",
        entityId: String(input.formId),
        payload: { boxes: existing.boxes, supplierId: existing.supplierId },
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
): Promise<(InboundFormRow & { supplier: Supplier | null }) | null> {
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
  return {
    ...r.form,
    supplierName: r.supplier?.name ?? "(unknown)",
    supplier: r.supplier,
  };
}

export async function countPendingInboundForms(): Promise<number> {
  const rows = await db
    .select({ id: inboundForms.id })
    .from(inboundForms)
    .where(eq(inboundForms.status, "pending"));
  return rows.length;
}

