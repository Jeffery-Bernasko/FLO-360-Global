import { and, asc, desc, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { suppliers, type Supplier } from "@/db/schema";
import { log } from "@/audit";
import { PartyError } from "@/lib/customers";

type Actor = { id: string; role: "worker" | "manager" };

function assertManager(actor: Actor) {
  if (actor.role !== "manager") {
    throw new PartyError("forbidden", "Only managers can manage parties.");
  }
}

const supplierInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  country: z.string().trim().max(100).optional().nullable(),
  contact: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

function normaliseInput(raw: unknown): {
  name: string;
  country: string | null;
  contact: string | null;
  notes: string | null;
} {
  const parsed = supplierInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new PartyError("invalid", parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const blank = (s: string | null | undefined) =>
    s == null || s === "" ? null : s;
  return {
    name: parsed.data.name,
    country: blank(parsed.data.country ?? null),
    contact: blank(parsed.data.contact ?? null),
    notes: blank(parsed.data.notes ?? null),
  };
}

export type CreateSupplierInput = {
  actor: Actor;
  name: string;
  country?: string | null;
  contact?: string | null;
  notes?: string | null;
};

export async function createSupplier(input: CreateSupplierInput): Promise<Supplier> {
  assertManager(input.actor);
  const data = normaliseInput(input);

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(suppliers)
      .values({
        name: data.name,
        country: data.country,
        contact: data.contact,
        notes: data.notes,
        isActive: true,
      })
      .returning();

    await log(
      {
        actorUserId: input.actor.id,
        action: "supplier.create",
        entityType: "supplier",
        entityId: created.id,
        payload: {
          name: created.name,
          country: created.country,
          contact: created.contact,
        },
      },
      tx,
    );

    return created;
  });
}

export type UpdateSupplierInput = {
  actor: Actor;
  supplierId: string;
  name: string;
  country?: string | null;
  contact?: string | null;
  notes?: string | null;
};

export async function updateSupplier(input: UpdateSupplierInput): Promise<Supplier> {
  assertManager(input.actor);
  const data = normaliseInput(input);

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(suppliers)
      .set({
        name: data.name,
        country: data.country,
        contact: data.contact,
        notes: data.notes,
      })
      .where(eq(suppliers.id, input.supplierId))
      .returning();

    if (!updated) {
      throw new PartyError("not_found", "Supplier not found.");
    }

    await log(
      {
        actorUserId: input.actor.id,
        action: "supplier.update",
        entityType: "supplier",
        entityId: updated.id,
        payload: {
          name: updated.name,
          country: updated.country,
          contact: updated.contact,
        },
      },
      tx,
    );

    return updated;
  });
}

export type SetActiveInput = {
  actor: Actor;
  supplierId: string;
};

export async function deactivateSupplier(input: SetActiveInput): Promise<void> {
  assertManager(input.actor);

  await db.transaction(async (tx) => {
    const result = await tx
      .update(suppliers)
      .set({ isActive: false })
      .where(and(eq(suppliers.id, input.supplierId), eq(suppliers.isActive, true)))
      .returning({ id: suppliers.id });

    if (result.length === 0) {
      throw new PartyError(
        "not_found_or_already_inactive",
        "Supplier not found or already inactive.",
      );
    }

    await log(
      {
        actorUserId: input.actor.id,
        action: "supplier.deactivate",
        entityType: "supplier",
        entityId: input.supplierId,
        payload: {},
      },
      tx,
    );
  });
}

export async function reactivateSupplier(input: SetActiveInput): Promise<void> {
  assertManager(input.actor);

  await db.transaction(async (tx) => {
    const result = await tx
      .update(suppliers)
      .set({ isActive: true })
      .where(and(eq(suppliers.id, input.supplierId), eq(suppliers.isActive, false)))
      .returning({ id: suppliers.id });

    if (result.length === 0) {
      throw new PartyError(
        "not_found_or_already_active",
        "Supplier not found or already active.",
      );
    }

    await log(
      {
        actorUserId: input.actor.id,
        action: "supplier.reactivate",
        entityType: "supplier",
        entityId: input.supplierId,
        payload: {},
      },
      tx,
    );
  });
}

export async function getSupplier(supplierId: string): Promise<Supplier | null> {
  const rows = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.id, supplierId))
    .limit(1);
  return rows[0] ?? null;
}

export async function listSuppliers(actor: Actor): Promise<Supplier[]> {
  assertManager(actor);
  return db
    .select()
    .from(suppliers)
    .orderBy(desc(suppliers.isActive), asc(suppliers.name));
}

const SEARCH_LIMIT = 20;

export async function searchActiveSuppliers(q: string): Promise<Supplier[]> {
  const term = q.trim();
  const where = term
    ? and(eq(suppliers.isActive, true), ilike(suppliers.name, `%${term}%`))
    : eq(suppliers.isActive, true);
  return db
    .select()
    .from(suppliers)
    .where(where)
    .orderBy(asc(suppliers.name))
    .limit(SEARCH_LIMIT);
}
