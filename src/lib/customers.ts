import { and, asc, desc, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { customers, type Customer } from "@/db/schema";
import { log } from "@/audit";

export class PartyError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PartyError";
    this.code = code;
  }
}

type Actor = { id: string; role: "worker" | "manager" };

function assertManager(actor: Actor) {
  if (actor.role !== "manager") {
    throw new PartyError("forbidden", "Only managers can manage parties.");
  }
}

const customerInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  phone: z.string().trim().max(50).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

function normaliseInput(raw: unknown): {
  name: string;
  phone: string | null;
  location: string | null;
  notes: string | null;
} {
  const parsed = customerInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new PartyError("invalid", parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const blank = (s: string | null | undefined) =>
    s == null || s === "" ? null : s;
  return {
    name: parsed.data.name,
    phone: blank(parsed.data.phone ?? null),
    location: blank(parsed.data.location ?? null),
    notes: blank(parsed.data.notes ?? null),
  };
}

export type CreateCustomerInput = {
  actor: Actor;
  name: string;
  phone?: string | null;
  location?: string | null;
  notes?: string | null;
};

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  assertManager(input.actor);
  const data = normaliseInput(input);

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(customers)
      .values({
        name: data.name,
        phone: data.phone,
        location: data.location,
        notes: data.notes,
        isActive: true,
      })
      .returning();

    await log(
      {
        actorUserId: input.actor.id,
        action: "customer.create",
        entityType: "customer",
        entityId: created.id,
        payload: {
          name: created.name,
          phone: created.phone,
          location: created.location,
        },
      },
      tx,
    );

    return created;
  });
}

export type UpdateCustomerInput = {
  actor: Actor;
  customerId: string;
  name: string;
  phone?: string | null;
  location?: string | null;
  notes?: string | null;
};

export async function updateCustomer(input: UpdateCustomerInput): Promise<Customer> {
  assertManager(input.actor);
  const data = normaliseInput(input);

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(customers)
      .set({
        name: data.name,
        phone: data.phone,
        location: data.location,
        notes: data.notes,
      })
      .where(eq(customers.id, input.customerId))
      .returning();

    if (!updated) {
      throw new PartyError("not_found", "Customer not found.");
    }

    await log(
      {
        actorUserId: input.actor.id,
        action: "customer.update",
        entityType: "customer",
        entityId: updated.id,
        payload: {
          name: updated.name,
          phone: updated.phone,
          location: updated.location,
        },
      },
      tx,
    );

    return updated;
  });
}

export type SetActiveInput = {
  actor: Actor;
  customerId: string;
};

export async function deactivateCustomer(input: SetActiveInput): Promise<void> {
  assertManager(input.actor);

  await db.transaction(async (tx) => {
    const result = await tx
      .update(customers)
      .set({ isActive: false })
      .where(and(eq(customers.id, input.customerId), eq(customers.isActive, true)))
      .returning({ id: customers.id });

    if (result.length === 0) {
      throw new PartyError(
        "not_found_or_already_inactive",
        "Customer not found or already inactive.",
      );
    }

    await log(
      {
        actorUserId: input.actor.id,
        action: "customer.deactivate",
        entityType: "customer",
        entityId: input.customerId,
        payload: {},
      },
      tx,
    );
  });
}

export async function reactivateCustomer(input: SetActiveInput): Promise<void> {
  assertManager(input.actor);

  await db.transaction(async (tx) => {
    const result = await tx
      .update(customers)
      .set({ isActive: true })
      .where(and(eq(customers.id, input.customerId), eq(customers.isActive, false)))
      .returning({ id: customers.id });

    if (result.length === 0) {
      throw new PartyError(
        "not_found_or_already_active",
        "Customer not found or already active.",
      );
    }

    await log(
      {
        actorUserId: input.actor.id,
        action: "customer.reactivate",
        entityType: "customer",
        entityId: input.customerId,
        payload: {},
      },
      tx,
    );
  });
}

export async function getCustomer(customerId: string): Promise<Customer | null> {
  const rows = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * List all customers (active and inactive). Active first, then alphabetical.
 * Manager-only — guarded both by `assertManager` here and by the page.
 */
export async function listCustomers(actor: Actor): Promise<Customer[]> {
  assertManager(actor);
  return db
    .select()
    .from(customers)
    .orderBy(desc(customers.isActive), asc(customers.name));
}

const SEARCH_LIMIT = 20;

/**
 * Active-only typeahead used by the PartyPicker. Empty `q` returns the first
 * SEARCH_LIMIT active customers alphabetically. Visible to any signed-in user
 * so workers can pick a customer when filling outbound forms (F6).
 */
export async function searchActiveCustomers(q: string): Promise<Customer[]> {
  const term = q.trim();
  const where = term
    ? and(eq(customers.isActive, true), ilike(customers.name, `%${term}%`))
    : eq(customers.isActive, true);
  return db
    .select()
    .from(customers)
    .where(where)
    .orderBy(asc(customers.name))
    .limit(SEARCH_LIMIT);
}
