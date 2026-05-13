import { describe, expect, it } from "vitest";
import {
  ForbiddenError,
  UnauthorizedError,
  requireManagerFromSession,
  requireUserFromSession,
} from "./auth-helpers";

const managerSession = {
  user: {
    id: "user-1",
    email: "manager@example.com",
    name: "Mgr",
    role: "manager" as const,
  },
  expires: new Date(Date.now() + 60_000).toISOString(),
};

const workerSession = {
  ...managerSession,
  user: { ...managerSession.user, id: "user-2", role: "worker" as const },
};

describe("requireUserFromSession", () => {
  it("throws Unauthorized when there is no session", () => {
    expect(() => requireUserFromSession(null)).toThrow(UnauthorizedError);
  });

  it("throws Unauthorized when the session has no user id", () => {
    expect(() =>
      requireUserFromSession({
        // @ts-expect-error testing missing fields
        user: {},
        expires: managerSession.expires,
      }),
    ).toThrow(UnauthorizedError);
  });

  it("throws Unauthorized when required user fields are missing", () => {
    expect(() =>
      requireUserFromSession({
        // @ts-expect-error testing missing fields
        user: { id: "user-3", role: "worker" },
        expires: managerSession.expires,
      }),
    ).toThrow(UnauthorizedError);
  });

  it("throws Unauthorized when role is invalid", () => {
    expect(() =>
      requireUserFromSession({
        // @ts-expect-error testing invalid role
        user: { ...workerSession.user, role: "admin" },
        expires: managerSession.expires,
      }),
    ).toThrow(UnauthorizedError);
  });

  it("returns the user when one is signed in", () => {
    const u = requireUserFromSession(workerSession);
    expect(u.id).toBe("user-2");
    expect(u.email).toBe("manager@example.com");
    expect(u.name).toBe("Mgr");
    expect(u.role).toBe("worker");
  });
});

describe("requireManagerFromSession", () => {
  it("throws Unauthorized when not signed in", () => {
    expect(() => requireManagerFromSession(null)).toThrow(UnauthorizedError);
  });

  it("throws Forbidden when signed in as worker", () => {
    expect(() => requireManagerFromSession(workerSession)).toThrow(
      ForbiddenError,
    );
  });

  it("returns the user when signed in as manager", () => {
    const u = requireManagerFromSession(managerSession);
    expect(u.id).toBe("user-1");
    expect(u.role).toBe("manager");
  });
});
