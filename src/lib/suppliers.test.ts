import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state: {
    selectRows: unknown[];
    insertReturning: unknown[];
    updateReturning: unknown[];
  } = {
    selectRows: [],
    insertReturning: [
      { id: "new-id", name: "Stub", country: null, contact: null, notes: null, isActive: true },
    ],
    updateReturning: [
      { id: "target-id", name: "Stub", country: null, contact: null, notes: null, isActive: true },
    ],
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
  createSupplier,
  deactivateSupplier,
  reactivateSupplier,
  searchActiveSuppliers,
  updateSupplier,
} from "./suppliers";
import { PartyError } from "./customers";

const manager = { id: "mgr-1", role: "manager" as const };
const worker = { id: "wkr-1", role: "worker" as const };

beforeEach(() => {
  mocks.state.selectRows = [];
  mocks.state.insertReturning = [
    { id: "new-id", name: "Stub", country: null, contact: null, notes: null, isActive: true },
  ];
  mocks.state.updateReturning = [
    { id: "target-id", name: "Stub", country: null, contact: null, notes: null, isActive: true },
  ];
  mocks.log.mockClear();
  mocks.db.transaction.mockClear();
});

describe("createSupplier", () => {
  it("rejects when called by a worker", async () => {
    await expect(
      createSupplier({ actor: worker, name: "ACME" }),
    ).rejects.toBeInstanceOf(PartyError);
  });

  it("rejects empty name after trim", async () => {
    await expect(
      createSupplier({ actor: manager, name: "  " }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("creates and audits", async () => {
    mocks.state.insertReturning = [
      {
        id: "s-1",
        name: "ACME",
        country: "China",
        contact: "li@acme.cn",
        notes: null,
        isActive: true,
      },
    ];
    const s = await createSupplier({
      actor: manager,
      name: "  ACME  ",
      country: "China",
      contact: "li@acme.cn",
    });
    expect(s.id).toBe("s-1");
    expect(mocks.db.transaction).toHaveBeenCalledOnce();
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "supplier.create",
        entityType: "supplier",
        entityId: "s-1",
      }),
      expect.anything(),
    );
  });
});

describe("updateSupplier", () => {
  it("throws not_found when no row updated", async () => {
    mocks.state.updateReturning = [];
    await expect(
      updateSupplier({ actor: manager, supplierId: "ghost", name: "X" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("deactivateSupplier", () => {
  it("rejects when called by a worker", async () => {
    await expect(
      deactivateSupplier({ actor: worker, supplierId: "s-1" }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("throws when no row affected", async () => {
    mocks.state.updateReturning = [];
    await expect(
      deactivateSupplier({ actor: manager, supplierId: "ghost" }),
    ).rejects.toMatchObject({ code: "not_found_or_already_inactive" });
  });

  it("audits on success", async () => {
    mocks.state.updateReturning = [{ id: "s-1" }];
    await deactivateSupplier({ actor: manager, supplierId: "s-1" });
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "supplier.deactivate" }),
      expect.anything(),
    );
  });
});

describe("reactivateSupplier", () => {
  it("audits on success", async () => {
    mocks.state.updateReturning = [{ id: "s-1" }];
    await reactivateSupplier({ actor: manager, supplierId: "s-1" });
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "supplier.reactivate" }),
      expect.anything(),
    );
  });
});

describe("searchActiveSuppliers", () => {
  it("returns rows from the underlying query", async () => {
    mocks.state.selectRows = [{ id: "s-1", name: "ACME", isActive: true }];
    const result = await searchActiveSuppliers("");
    expect(result).toHaveLength(1);
  });
});
