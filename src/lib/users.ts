import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { log } from "@/audit";
import { generateTempPassword, hashPassword } from "@/lib/passwords";

export class UserError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "UserError";
    this.code = code;
  }
}

type Actor = { id: string; role: "worker" | "manager" };

function assertManager(actor: Actor) {
  if (actor.role !== "manager") {
    throw new UserError("forbidden", "Only managers can manage users.");
  }
}

function isUniqueViolationError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

export type CreateWorkerInput = {
  actor: Actor;
  name: string;
  email: string;
};

export type CreateWorkerResult = {
  userId: string;
  email: string;
  tempPassword: string;
};

/**
 * Creates a new worker account with a freshly generated temp password.
 * Returns the temp password exactly once; the caller is responsible for
 * displaying it to the manager.
 */
export async function createWorker(
  input: CreateWorkerInput,
): Promise<CreateWorkerResult> {
  assertManager(input.actor);

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if (!name) throw new UserError("invalid", "Name is required.");
  if (!email || !email.includes("@")) {
    throw new UserError("invalid", "A valid email is required.");
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    throw new UserError(
      "duplicate_email",
      "A user with that email already exists.",
    );
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  let createdId = "";
  try {
    await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({
          email,
          name,
          passwordHash,
          role: "worker",
          isActive: true,
        })
        .returning({ id: users.id });

      createdId = created.id;

      await log(
        {
          actorUserId: input.actor.id,
          action: "user.create",
          entityType: "user",
          entityId: created.id,
          payload: { email, name, role: "worker" },
        },
        tx,
      );
    });
  } catch (err) {
    if (isUniqueViolationError(err)) {
      throw new UserError(
        "duplicate_email",
        "A user with that email already exists.",
      );
    }
    throw err;
  }

  return { userId: createdId, email, tempPassword };
}

export type SetActiveInput = {
  actor: Actor;
  targetUserId: string;
};

export async function deactivateUser(input: SetActiveInput): Promise<void> {
  assertManager(input.actor);

  if (input.targetUserId === input.actor.id) {
    throw new UserError(
      "self_deactivate",
      "You cannot deactivate your own account.",
    );
  }

  await db.transaction(async (tx) => {
    const result = await tx
      .update(users)
      .set({ isActive: false })
      .where(and(eq(users.id, input.targetUserId), eq(users.isActive, true)))
      .returning({ id: users.id });

    if (result.length === 0) {
      throw new UserError(
        "not_found_or_already_inactive",
        "User not found or already inactive.",
      );
    }

    await log(
      {
        actorUserId: input.actor.id,
        action: "user.deactivate",
        entityType: "user",
        entityId: input.targetUserId,
        payload: {},
      },
      tx,
    );
  });
}

export async function reactivateUser(input: SetActiveInput): Promise<void> {
  assertManager(input.actor);

  await db.transaction(async (tx) => {
    const result = await tx
      .update(users)
      .set({ isActive: true })
      .where(and(eq(users.id, input.targetUserId), eq(users.isActive, false)))
      .returning({ id: users.id });

    if (result.length === 0) {
      throw new UserError(
        "not_found_or_already_active",
        "User not found or already active.",
      );
    }

    await log(
      {
        actorUserId: input.actor.id,
        action: "user.reactivate",
        entityType: "user",
        entityId: input.targetUserId,
        payload: {},
      },
      tx,
    );
  });
}

export type ResetPasswordResult = {
  userId: string;
  tempPassword: string;
};

export async function resetUserPassword(
  input: SetActiveInput,
): Promise<ResetPasswordResult> {
  assertManager(input.actor);

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  await db.transaction(async (tx) => {
    const result = await tx
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, input.targetUserId))
      .returning({ id: users.id });

    if (result.length === 0) {
      throw new UserError("not_found", "User not found.");
    }

    await log(
      {
        actorUserId: input.actor.id,
        action: "user.password_reset",
        entityType: "user",
        entityId: input.targetUserId,
        payload: {},
      },
      tx,
    );
  });

  return { userId: input.targetUserId, tempPassword };
}

/**
 * List all users for the management screen. Manager-only by virtue of being
 * called from a manager-guarded server component. Active users first, then
 * inactive — alphabetically inside each group.
 */
export async function listUsers(actor: Actor) {
  assertManager(actor);
  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.isActive), asc(users.name));
}
