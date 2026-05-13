import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  // Configurable per-test return values for the two query chains we use.
  const state: {
    selectRows: unknown[];
    insertReturning: unknown[];
    updateReturning: unknown[];
  } = {
    selectRows: [],
    insertReturning: [{ id: "new-user-id" }],
    updateReturning: [{ id: "target-user-id" }],
  };

  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => state.selectRows),
      })),
      orderBy: vi.fn(async () => state.selectRows),
    })),
  }));

  const insert = vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(async () => state.insertReturning),
    })),
  }));

  const update = vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => state.updateReturning),
      })),
    })),
  }));

  return {
    state,
    db: { select, insert, update },
    log: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/db", () => ({ db: mocks.db }));
vi.mock("@/audit", () => ({ log: mocks.log }));

import {
  UserError,
  createWorker,
  deactivateUser,
  reactivateUser,
  resetUserPassword,
} from "./users";

const manager = { id: "mgr-1", role: "manager" as const };
const worker = { id: "wkr-1", role: "worker" as const };

beforeEach(() => {
  mocks.state.selectRows = [];
  mocks.state.insertReturning = [{ id: "new-user-id" }];
  mocks.state.updateReturning = [{ id: "target-user-id" }];
  mocks.log.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createWorker", () => {
  it("rejects when called by a worker", async () => {
    await expect(
      createWorker({ actor: worker, name: "Kojo", email: "k@x.com" }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rejects when name is empty", async () => {
    await expect(
      createWorker({ actor: manager, name: "   ", email: "k@x.com" }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("rejects when email is invalid", async () => {
    await expect(
      createWorker({ actor: manager, name: "Kojo", email: "not-an-email" }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("rejects when email already exists", async () => {
    mocks.state.selectRows = [{ id: "existing-user" }];
    await expect(
      createWorker({ actor: manager, name: "Kojo", email: "k@x.com" }),
    ).rejects.toMatchObject({ code: "duplicate_email" });
  });

  it("creates a worker, returns the temp password, and writes an audit entry", async () => {
    mocks.state.selectRows = [];
    mocks.state.insertReturning = [{ id: "new-user-id" }];

    const result = await createWorker({
      actor: manager,
      name: "  Kojo  ",
      email: "  K@X.com ",
    });

    expect(result.userId).toBe("new-user-id");
    expect(result.email).toBe("k@x.com");
    expect(result.tempPassword.length).toBeGreaterThanOrEqual(10);
    expect(mocks.log).toHaveBeenCalledOnce();
    expect(mocks.log).toHaveBeenCalledWith({
      actorUserId: manager.id,
      action: "user.create",
      entityType: "user",
      entityId: "new-user-id",
      payload: { email: "k@x.com", name: "Kojo", role: "worker" },
    });
  });
});

describe("deactivateUser", () => {
  it("rejects when called by a worker", async () => {
    await expect(
      deactivateUser({ actor: worker, targetUserId: "x" }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rejects when target is the actor", async () => {
    await expect(
      deactivateUser({ actor: manager, targetUserId: manager.id }),
    ).rejects.toMatchObject({ code: "self_deactivate" });
  });

  it("throws when no row is updated (already inactive or missing)", async () => {
    mocks.state.updateReturning = [];
    await expect(
      deactivateUser({ actor: manager, targetUserId: "ghost" }),
    ).rejects.toMatchObject({ code: "not_found_or_already_inactive" });
    expect(mocks.log).not.toHaveBeenCalled();
  });

  it("logs on success", async () => {
    mocks.state.updateReturning = [{ id: "target-user-id" }];
    await deactivateUser({ actor: manager, targetUserId: "target-user-id" });
    expect(mocks.log).toHaveBeenCalledOnce();
    expect(mocks.log).toHaveBeenCalledWith({
      actorUserId: manager.id,
      action: "user.deactivate",
      entityType: "user",
      entityId: "target-user-id",
      payload: {},
    });
  });
});

describe("reactivateUser", () => {
  it("rejects when called by a worker", async () => {
    await expect(
      reactivateUser({ actor: worker, targetUserId: "x" }),
    ).rejects.toBeInstanceOf(UserError);
  });

  it("logs on success", async () => {
    mocks.state.updateReturning = [{ id: "target-user-id" }];
    await reactivateUser({ actor: manager, targetUserId: "target-user-id" });
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.reactivate" }),
    );
  });
});

describe("resetUserPassword", () => {
  it("rejects when called by a worker", async () => {
    await expect(
      resetUserPassword({ actor: worker, targetUserId: "x" }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("returns a new temp password and logs", async () => {
    mocks.state.updateReturning = [{ id: "target-user-id" }];
    const result = await resetUserPassword({
      actor: manager,
      targetUserId: "target-user-id",
    });
    expect(result.userId).toBe("target-user-id");
    expect(result.tempPassword.length).toBeGreaterThanOrEqual(10);
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "user.password_reset" }),
    );
  });

  it("throws when target user does not exist", async () => {
    mocks.state.updateReturning = [];
    await expect(
      resetUserPassword({ actor: manager, targetUserId: "ghost" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
