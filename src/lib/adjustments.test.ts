import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state: {
    stockSumRows: { total: string }[];
  } = {
    stockSumRows: [{ total: "100" }],
  };

  // Drizzle: `await tx.select({total: sql...}).from(stockMovements)` resolves
  // directly. Make from() thenable.
  const fromBuilder = {
    where: vi.fn(() => fromBuilder),
    then: (resolve: (rows: unknown) => void) => resolve(state.stockSumRows),
  };
  const select = vi.fn(() => ({ from: vi.fn(() => fromBuilder) }));

  const db = {
    select,
    transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(db)),
  };

  return {
    state,
    db,
    log: vi.fn().mockResolvedValue(undefined),
    recordMovement: vi.fn().mockResolvedValue({ id: 7n }),
  };
});

vi.mock("@/db", () => ({ db: mocks.db }));
vi.mock("@/audit", () => ({ log: mocks.log }));
vi.mock("@/lib/stock-ledger", () => ({
  recordMovement: mocks.recordMovement,
}));

import {
  AdjustmentError,
  recordAdjustment,
} from "./adjustments";

const manager = { id: "mgr-1", role: "manager" as const };
const worker = { id: "wkr-1", role: "worker" as const };

beforeEach(() => {
  mocks.state.stockSumRows = [{ total: "100" }];
  mocks.log.mockClear();
  mocks.recordMovement.mockClear();
  mocks.db.transaction.mockClear();
});

describe("recordAdjustment guards", () => {
  it("rejects worker callers", async () => {
    await expect(
      recordAdjustment({
        actor: worker,
        boxesDelta: -1,
        reason: "Damaged",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(mocks.recordMovement).not.toHaveBeenCalled();
  });

  it("rejects zero delta", async () => {
    await expect(
      recordAdjustment({
        actor: manager,
        boxesDelta: 0,
        reason: "Damaged",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("rejects non-integer delta", async () => {
    await expect(
      recordAdjustment({
        actor: manager,
        boxesDelta: 1.5,
        reason: "Damaged",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("rejects unknown reason", async () => {
    await expect(
      recordAdjustment({
        actor: manager,
        boxesDelta: -1,
        reason: "Surprise",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
  });
});

describe("recordAdjustment stock guard", () => {
  it("rejects a negative delta that would drive stock below zero", async () => {
    mocks.state.stockSumRows = [{ total: "5" }];
    await expect(
      recordAdjustment({
        actor: manager,
        boxesDelta: -10,
        reason: "Damaged",
      }),
    ).rejects.toMatchObject({ code: "would_go_negative" });
    expect(mocks.recordMovement).not.toHaveBeenCalled();
  });

  it("allows a negative delta equal to current stock (lands at 0)", async () => {
    mocks.state.stockSumRows = [{ total: "5" }];
    const result = await recordAdjustment({
      actor: manager,
      boxesDelta: -5,
      reason: "Damaged",
    });
    expect(result.resultingStock).toBe(0);
  });
});

describe("recordAdjustment happy path", () => {
  it("calls recordMovement with kind=adjustment and the right delta + reason", async () => {
    mocks.state.stockSumRows = [{ total: "100" }];

    const result = await recordAdjustment({
      actor: manager,
      boxesDelta: -3,
      reason: "Damaged",
      note: "Two boxes crushed in transit",
    });

    expect(result.movementId).toBe(7n);
    expect(result.resultingStock).toBe(97);
    expect(mocks.db.transaction).toHaveBeenCalledOnce();

    expect(mocks.recordMovement).toHaveBeenCalledOnce();
    expect(mocks.recordMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "adjustment",
        boxesDelta: -3,
        reason: "Damaged",
        actor: { id: manager.id },
      }),
      expect.anything(),
    );

    expect(mocks.log).toHaveBeenCalledOnce();
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "adjustment.create",
        entityType: "stock_movement",
        entityId: "7",
        payload: {
          boxesDelta: -3,
          reason: "Damaged",
          note: "Two boxes crushed in transit",
          resultingStock: 97,
        },
      }),
      expect.anything(),
    );
  });

  it("accepts positive deltas (e.g. recount up)", async () => {
    mocks.state.stockSumRows = [{ total: "100" }];
    const result = await recordAdjustment({
      actor: manager,
      boxesDelta: 5,
      reason: "Recount",
    });
    expect(result.resultingStock).toBe(105);
    expect(mocks.recordMovement).toHaveBeenCalledWith(
      expect.objectContaining({ boxesDelta: 5, reason: "Recount" }),
      expect.anything(),
    );
  });

  it("stores null note when not provided", async () => {
    mocks.state.stockSumRows = [{ total: "100" }];
    await recordAdjustment({
      actor: manager,
      boxesDelta: -1,
      reason: "Other",
    });
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ note: null }),
      }),
      expect.anything(),
    );
  });

  it("normalizes whitespace-only notes to null", async () => {
    mocks.state.stockSumRows = [{ total: "100" }];
    await recordAdjustment({
      actor: manager,
      boxesDelta: -1,
      reason: "Other",
      note: "   ",
    });
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ note: null }),
      }),
      expect.anything(),
    );
  });
});

describe("AdjustmentError shape", () => {
  it("carries a stable code", () => {
    const err = new AdjustmentError("invalid", "boom");
    expect(err.code).toBe("invalid");
    expect(err.name).toBe("AdjustmentError");
  });
});
