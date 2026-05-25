import { and, asc, desc, eq, ilike, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { products, type Product } from "@/db/schema";
import { log } from "@/audit";

export class ProductError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ProductError";
    this.code = code;
  }
}

type Actor = { id: string; role: "worker" | "manager" };

function assertManager(actor: Actor) {
  if (actor.role !== "manager") {
    throw new ProductError("forbidden", "Only managers can manage products.");
  }
}

const productInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  description: z.string().trim().max(2000).optional().nullable(),
});

function normaliseInput(raw: unknown): {
  name: string;
  description: string | null;
} {
  const parsed = productInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ProductError("invalid", parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const blank = (s: string | null | undefined) =>
    s == null || s === "" ? null : s;
  return {
    name: parsed.data.name,
    description: blank(parsed.data.description ?? null),
  };
}

async function assertUniqueName(
  name: string,
  excludeId?: string,
): Promise<void> {
  const where = excludeId
    ? and(
        eq(products.isActive, true),
        ilike(products.name, name),
        ne(products.id, excludeId),
      )
    : and(eq(products.isActive, true), ilike(products.name, name));

  const existing = await db
    .select({ id: products.id })
    .from(products)
    .where(where)
    .limit(1);

  if (existing.length > 0) {
    throw new ProductError("duplicate", "An active product with this name already exists.");
  }
}

export type CreateProductInput = {
  actor: Actor;
  name: string;
  description?: string | null;
};

export async function createProduct(input: CreateProductInput): Promise<Product> {
  assertManager(input.actor);
  const data = normaliseInput(input);

  await assertUniqueName(data.name);

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(products)
      .values({
        name: data.name,
        description: data.description,
        isActive: true,
      })
      .returning();

    await log(
      {
        actorUserId: input.actor.id,
        action: "product.create",
        entityType: "product",
        entityId: created.id,
        payload: {
          name: created.name,
          description: created.description,
        },
      },
      tx,
    );

    return created;
  });
}

export type UpdateProductInput = {
  actor: Actor;
  productId: string;
  name: string;
  description?: string | null;
};

export async function updateProduct(input: UpdateProductInput): Promise<Product> {
  assertManager(input.actor);
  const data = normaliseInput(input);

  await assertUniqueName(data.name, input.productId);

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(products)
      .set({
        name: data.name,
        description: data.description,
      })
      .where(eq(products.id, input.productId))
      .returning();

    if (!updated) {
      throw new ProductError("not_found", "Product not found.");
    }

    await log(
      {
        actorUserId: input.actor.id,
        action: "product.update",
        entityType: "product",
        entityId: updated.id,
        payload: {
          name: updated.name,
          description: updated.description,
        },
      },
      tx,
    );

    return updated;
  });
}

export type SetActiveInput = {
  actor: Actor;
  productId: string;
};

export async function deactivateProduct(input: SetActiveInput): Promise<void> {
  assertManager(input.actor);

  await db.transaction(async (tx) => {
    const result = await tx
      .update(products)
      .set({ isActive: false })
      .where(and(eq(products.id, input.productId), eq(products.isActive, true)))
      .returning({ id: products.id });

    if (result.length === 0) {
      throw new ProductError(
        "not_found_or_already_inactive",
        "Product not found or already inactive.",
      );
    }

    await log(
      {
        actorUserId: input.actor.id,
        action: "product.deactivate",
        entityType: "product",
        entityId: input.productId,
        payload: {},
      },
      tx,
    );
  });
}

export async function reactivateProduct(input: SetActiveInput): Promise<void> {
  assertManager(input.actor);

  await db.transaction(async (tx) => {
    const result = await tx
      .update(products)
      .set({ isActive: true })
      .where(and(eq(products.id, input.productId), eq(products.isActive, false)))
      .returning({ id: products.id });

    if (result.length === 0) {
      throw new ProductError(
        "not_found_or_already_active",
        "Product not found or already active.",
      );
    }

    await log(
      {
        actorUserId: input.actor.id,
        action: "product.reactivate",
        entityType: "product",
        entityId: input.productId,
        payload: {},
      },
      tx,
    );
  });
}

export async function getProduct(productId: string): Promise<Product | null> {
  const rows = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  return rows[0] ?? null;
}

export async function listProducts(actor: Actor): Promise<Product[]> {
  assertManager(actor);
  return db
    .select()
    .from(products)
    .orderBy(desc(products.isActive), asc(products.name));
}

const SEARCH_LIMIT = 20;

export async function searchActiveProducts(q: string): Promise<Product[]> {
  const term = q.trim();
  const where = term
    ? and(eq(products.isActive, true), ilike(products.name, `%${term}%`))
    : eq(products.isActive, true);
  return db
    .select()
    .from(products)
    .where(where)
    .orderBy(asc(products.name))
    .limit(SEARCH_LIMIT);
}
