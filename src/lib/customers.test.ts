import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state: {
    selectRows: unknown[];
    insertReturning: unknown[];
    updateReturning: unknown[];
  } = {
    selectRows: [],
    insertReturning: [{ id: "new-id", name: "Stub", phone: null, location: null, notes: null, isActive: true }],
    updateReturning: [{ id: "target-id", name: "Stub", phone: null, location: null, notes: null, isActive: true }],
  };

  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => state.selectRows),
        orderBy: vi.fn(() => ({
          limit: vi.fn(async () => state.selectRows),
        })),
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

  const db = {
    select,
    insert,
    update,
    transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(db)),
  };

  return { state, db, log: vi.fn().mockResolvedValue(undefined) };
});

vi.mock("@/db", () => ({ db: mocks.db }));
vi.mock("@/audit", () => ({ log: mocks.log }));

import {
  PartyError,
  createCustomer,
  deactivateCustomer,
  reactivateCustomer,
  searchActiveCustomers,
  updateCustomer,
} from "./customers";

const manager = { id: "mgr-1", role: "manager" as const };
const worker = { id: "wkr-1", role: "worker" as const };

beforeEach(() => {
  mocks.state.selectRows = [];
  mocks.state.insertReturning = [
    { id: "new-id", name: "Stub", phone: null, location: null, notes: null, isActive: true },
  ];
  mocks.state.updateReturning = [
    { id: "target-id", name: "Stub", phone: null, location: null, notes: null, isActive: true },
  ];
  mocks.log.mockClear();
  mocks.db.transaction.mockClear();
});

describe("createCustomer", () => {
  it("rejects when called by a worker", async () => {
    await expect(
      createCustomer({ actor: worker, name: "Aba" }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rejects when name is empty after trim", async () => {
    await expect(
      createCustomer({ actor: manager, name: "   " }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("creates and audits with trimmed fields", async () => {
    mocks.state.insertReturning = [
      {
        id: "c-1",
        name: "Aba",
        phone: "0244",
        location: "Accra",
        notes: null,
        isActive: true,
      },
    ];

    const c = await createCustomer({
      actor: manager,
      name: "  Aba  ",
      phone: "  0244  ",
      location: "Accra",
    });

    expect(c.id).toBe("c-1");
    expect(mocks.db.transaction).toHaveBeenCalledOnce();
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "customer.create",
        entityType: "customer",
        entityId: "c-1",
      }),
      expect.anything(),
    );
  });

  it("converts blank optional fields to null", async () => {
    mocks.state.insertReturning = [
      {
        id: "c-2",
        name: "Aba",
        phone: null,
        location: null,
        notes: null,
        isActive: true,
      },
    ];
    await createCustomer({
      actor: manager,
      name: "Aba",
      phone: "",
      location: "",
      notes: "",
    });
    expect(mocks.log).toHaveBeenCalled();
  });
});

describe("updateCustomer", () => {
  it("rejects when called by a worker", async () => {
    await expect(
      updateCustomer({ actor: worker, customerId: "c-1", name: "X" }),
    ).rejects.toBeInstanceOf(PartyError);
  });

  it("throws not_found when no row updated", async () => {
    mocks.state.updateReturning = [];
    await expect(
      updateCustomer({ actor: manager, customerId: "ghost", name: "X" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("audits on success", async () => {
    mocks.state.updateReturning = [
      {
        id: "c-1",
        name: "Aba B",
        phone: "0244",
        location: "Accra",
        notes: null,
        isActive: true,
      },
    ];
    await updateCustomer({
      actor: manager,
      customerId: "c-1",
      name: "Aba B",
      phone: "0244",
      location: "Accra",
    });
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "customer.update", entityId: "c-1" }),
      expect.anything(),
    );
  });
});

describe("deactivateCustomer", () => {
  it("rejects when called by a worker", async () => {
    await expect(
      deactivateCustomer({ actor: worker, customerId: "c-1" }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("throws when no row affected (already inactive or missing)", async () => {
    mocks.state.updateReturning = [];
    await expect(
      deactivateCustomer({ actor: manager, customerId: "ghost" }),
    ).rejects.toMatchObject({ code: "not_found_or_already_inactive" });
    expect(mocks.log).not.toHaveBeenCalled();
  });

  it("audits on success", async () => {
    mocks.state.updateReturning = [{ id: "c-1" }];
    await deactivateCustomer({ actor: manager, customerId: "c-1" });
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "customer.deactivate" }),
      expect.anything(),
    );
  });
});

describe("reactivateCustomer", () => {
  it("throws when no row affected", async () => {
    mocks.state.updateReturning = [];
    await expect(
      reactivateCustomer({ actor: manager, customerId: "ghost" }),
    ).rejects.toMatchObject({ code: "not_found_or_already_active" });
  });

  it("audits on success", async () => {
    mocks.state.updateReturning = [{ id: "c-1" }];
    await reactivateCustomer({ actor: manager, customerId: "c-1" });
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "customer.reactivate" }),
      expect.anything(),
    );
  });
});

describe("searchActiveCustomers", () => {
  it("returns rows from the underlying query", async () => {
    mocks.state.selectRows = [{ id: "c-1", name: "Aba", isActive: true }];
    const result = await searchActiveCustomers("ab");
    expect(result).toHaveLength(1);
  });
});
