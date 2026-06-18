import { beforeEach, describe, expect, it, vi } from "vitest";

const PRODUCT_ID = "00000000-0000-4000-a000-000000000001";

const mocks = vi.hoisted(() => {
  let stockForProduct = 100;

  const db = {
    transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(db)),
  };

  return {
    get stockForProduct() { return stockForProduct; },
    set stockForProduct(v: number) { stockForProduct = v; },
    db,
    log: vi.fn().mockResolvedValue(undefined),
    recordMovement: vi.fn().mockResolvedValue({ id: 7n }),
    getStockForProduct: vi.fn(async () => stockForProduct),
  };
});

vi.mock("@/db", () => ({ db: mocks.db }));
vi.mock("@/audit", () => ({ log: mocks.log }));
vi.mock("@/lib/stock-ledger", () => ({
  recordMovement: mocks.recordMovement,
  getStockForProduct: mocks.getStockForProduct,
}));

import {
  AdjustmentError,
  recordAdjustment,
} from "./adjustments";

const manager = { id: "mgr-1", role: "manager" as const };
const worker = { id: "wkr-1", role: "worker" as const };

beforeEach(() => {
  mocks.stockForProduct = 100;
  mocks.log.mockClear();
  mocks.recordMovement.mockClear();
  mocks.getStockForProduct.mockClear();
  mocks.db.transaction.mockClear();
});

describe("recordAdjustment guards", () => {
  it("rejects worker callers", async () => {
    await expect(
      recordAdjustment({
        actor: worker,
        productId: PRODUCT_ID,
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
        productId: PRODUCT_ID,
        boxesDelta: 0,
        reason: "Damaged",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("rejects non-integer delta", async () => {
    await expect(
      recordAdjustment({
        actor: manager,
        productId: PRODUCT_ID,
        boxesDelta: 1.5,
        reason: "Damaged",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("rejects unknown reason", async () => {
    await expect(
      recordAdjustment({
        actor: manager,
        productId: PRODUCT_ID,
        boxesDelta: -1,
        reason: "Surprise",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("rejects missing productId", async () => {
    await expect(
      recordAdjustment({
        actor: manager,
        productId: "",
        boxesDelta: -1,
        reason: "Damaged",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
  });
});

describe("recordAdjustment stock guard", () => {
  it("rejects a negative delta that would drive stock below zero", async () => {
    mocks.stockForProduct = 5;
    mocks.getStockForProduct.mockResolvedValueOnce(5);
    await expect(
      recordAdjustment({
        actor: manager,
        productId: PRODUCT_ID,
        boxesDelta: -10,
        reason: "Damaged",
      }),
    ).rejects.toMatchObject({ code: "would_go_negative" });
    expect(mocks.recordMovement).not.toHaveBeenCalled();
  });

  it("allows a negative delta equal to current stock (lands at 0)", async () => {
    mocks.stockForProduct = 5;
    mocks.getStockForProduct.mockResolvedValueOnce(5);
    const result = await recordAdjustment({
      actor: manager,
      productId: PRODUCT_ID,
      boxesDelta: -5,
      reason: "Damaged",
    });
    expect(result.resultingStock).toBe(0);
  });
});

describe("recordAdjustment happy path", () => {
  it("calls recordMovement with kind=adjustment and the right delta + reason", async () => {
    mocks.getStockForProduct.mockResolvedValueOnce(100);

    const result = await recordAdjustment({
      actor: manager,
      productId: PRODUCT_ID,
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
        productId: PRODUCT_ID,
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
    mocks.getStockForProduct.mockResolvedValueOnce(100);
    const result = await recordAdjustment({
      actor: manager,
      productId: PRODUCT_ID,
      boxesDelta: 5,
      reason: "Recount",
    });
    expect(result.resultingStock).toBe(105);
    expect(mocks.recordMovement).toHaveBeenCalledWith(
      expect.objectContaining({ boxesDelta: 5, reason: "Recount", productId: PRODUCT_ID }),
      expect.anything(),
    );
  });

  it("stores null note when not provided", async () => {
    mocks.getStockForProduct.mockResolvedValueOnce(100);
    await recordAdjustment({
      actor: manager,
      productId: PRODUCT_ID,
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
    mocks.getStockForProduct.mockResolvedValueOnce(100);
    await recordAdjustment({
      actor: manager,
      productId: PRODUCT_ID,
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
