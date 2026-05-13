import type { Session } from "next-auth";
import type { UserRole } from "@/db/schema";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

/**
 * Validates a Session object and returns the user, or throws.
 * Pure helper — used by tests and by server-side `requireUser` / `requireManager`.
 */
export function requireUserFromSession(
  session: Session | null,
): AuthenticatedUser {
  if (!session?.user?.id) throw new UnauthorizedError();
  if (!session.user.email || !session.user.name) throw new UnauthorizedError();
  if (session.user.role !== "worker" && session.user.role !== "manager") {
    throw new UnauthorizedError();
  }
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  };
}

export function requireManagerFromSession(
  session: Session | null,
): AuthenticatedUser {
  const user = requireUserFromSession(session);
  if (user.role !== "manager") throw new ForbiddenError();
  return user;
}
