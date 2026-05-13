import { auth } from "@/auth";
import {
  type AuthenticatedUser,
  requireManagerFromSession,
  requireUserFromSession,
} from "@/auth-helpers";

/**
 * Returns the current signed-in user, or throws UnauthorizedError.
 * Use in server components, server actions, and route handlers.
 */
export async function requireUser(): Promise<AuthenticatedUser> {
  const session = await auth();
  return requireUserFromSession(session);
}

/**
 * Returns the current signed-in user only if they are a manager.
 * Throws UnauthorizedError if not signed in, ForbiddenError if not a manager.
 */
export async function requireManager(): Promise<AuthenticatedUser> {
  const session = await auth();
  return requireManagerFromSession(session);
}
