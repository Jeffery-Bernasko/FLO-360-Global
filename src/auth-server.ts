import { auth } from "@/auth";
import { db } from "@/db";
import {
  UnauthorizedError,
  type AuthenticatedUser,
  requireManagerFromSession,
  requireUserFromSession,
} from "@/auth-helpers";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Returns the current signed-in user, or throws UnauthorizedError.
 * Use in server components, server actions, and route handlers.
 */
export async function requireUser(): Promise<AuthenticatedUser> {
  const session = await auth();
  const sessionUser = requireUserFromSession(session);
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, sessionUser.id),
    columns: {
      email: true,
      name: true,
      role: true,
      isActive: true,
    },
  });
  if (!dbUser) throw new UnauthorizedError();
  if (!dbUser.isActive) throw new UnauthorizedError();
  return {
    ...sessionUser,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role,
  };
}

/**
 * Returns the current signed-in user only if they are a manager.
 * Throws UnauthorizedError if not signed in, ForbiddenError if not a manager.
 */
export async function requireManager(): Promise<AuthenticatedUser> {
  const session = await auth();
  return requireManagerFromSession(session);
}
