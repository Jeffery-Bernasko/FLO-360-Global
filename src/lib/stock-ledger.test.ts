import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state: {
    insertReturning: { id: bigint }[];
    selectSumRows: { total: string }[];
    selectMovementsRows: unknown[];
  } = {
    insertReturning: [{ id: 1n }],
    selectSumRows: [{ total: "0" }],
    selectMovementsRows: [],
  };

  // db.insert(...).values(...).returning(...) -> returning rows
  const insertReturning = vi.fn(async () => state.insertReturning);
  const insertValues = vi.fn(() => ({ returning: insertReturning }));
  const insert = vi.fn(() => ({ values: insertValues }));

  // Two select shapes:
  //  - getCurrentStock: db.select({total}).from(stockMovements) -> sum row
  //  - getMovements:    db.select().from(stockMovements).where(...).orderBy(...).limit(...) -> rows
  const limitFn = vi.fn(async () => state.selectMovementsRows);
  const orderByFn = vi.fn(() => ({ limit: limitFn }));
  const whereFn = vi.fn(() => ({ orderBy: orderByFn }));

  const fromForSelect = vi.fn(() => ({
    where: whereFn,
    // For the SUM call there's no where/orderBy; the awaited promise should
    // resolve to the sum row. drizzle .from returns a Promise-like; we use
    // `then` so `await client.select(...).from(...)` resolves directly.
    then: (resolve: (rows: { total: string }[]) => void) =>
      resolve(state.selectSumRows),
  }));

  const select = vi.fn(() => ({ from: fromForSelect }));

  return {
    state,
    db: { insert, select },
    log: vi.fn().mockResolvedValue(undefined),
    spies: { insert, insertValues, insertReturning, select, fromForSelect, whereFn, orderByFn, limitFn },
  };
});

vi.mock("@/db", () => ({ db: mocks.db }));
vi.mock("@/audit", () => ({ log: mocks.log }));

import {
  StockLedgerError,
  getCurrentStock,
  getMovements,
  recordMovement,
} from "./stock-ledger";

const actor = { id: "user-1" };
const productId = "00000000-0000-4000-a000-000000000001";

beforeEach(() => {
  mocks.state.insertReturning = [{ id: 42n }];
  mocks.state.selectSumRows = [{ total: "0" }];
  mocks.state.selectMovementsRows = [];
  mocks.log.mockClear();
  for (const spy of Object.values(mocks.spies)) spy.mockClear();
});

describe("recordMovement validation", () => {
  it("rejects a non-integer delta", async () => {
    await expect(
      recordMovement({ kind: "adjustment", boxesDelta: 1.5, productId, actor }),
    ).rejects.toMatchObject({ code: "invalid_delta" });
  });

  it("rejects a zero delta", async () => {
    await expect(
      recordMovement({ kind: "adjustment", boxesDelta: 0, productId, actor }),
    ).rejects.toMatchObject({ code: "invalid_delta" });
  });

  it("rejects an inbound with negative delta", async () => {
    await expect(
      recordMovement({ kind: "inbound", boxesDelta: -3, productId, actor }),
    ).rejects.toMatchObject({ code: "invalid_delta_for_kind" });
  });

  it("rejects an outbound with positive delta", async () => {
    await expect(
      recordMovement({ kind: "outbound", boxesDelta: 3, productId, actor }),
    ).rejects.toMatchObject({ code: "invalid_delta_for_kind" });
  });

  it("rejects when only one of sourceFormKind / sourceFormId is set", async () => {
    await expect(
      recordMovement({
        kind: "inbound",
        boxesDelta: 10,
        sourceFormKind: "inbound",
        productId,
        actor,
      }),
    ).rejects.toMatchObject({ code: "incomplete_source" });
  });

  it("rejects when sourceFormKind disagrees with kind", async () => {
    await expect(
      recordMovement({
        kind: "inbound",
        boxesDelta: 10,
        sourceFormKind: "outbound",
        sourceFormId: 9n,
        productId,
        actor,
      }),
    ).rejects.toMatchObject({ code: "mismatched_source" });
  });

  it("rejects an adjustment that references a source form", async () => {
    await expect(
      recordMovement({
        kind: "adjustment",
        boxesDelta: -2,
        sourceFormKind: "outbound",
        sourceFormId: 5n,
        productId,
        actor,
      }),
    ).rejects.toMatchObject({ code: "adjustment_with_source" });
  });
});

describe("recordMovement happy path", () => {
  it("inserts the row, returns the id, and writes a ledger.write audit entry", async () => {
    mocks.state.insertReturning = [{ id: 99n }];

    const result = await recordMovement({
      kind: "inbound",
      boxesDelta: 100,
      reason: "Shipment 23",
      sourceFormKind: "inbound",
      sourceFormId: 7n,
      productId,
      actor,
    });

    expect(result.id).toBe(99n);

    expect(mocks.spies.insertValues).toHaveBeenCalledOnce();
    expect(mocks.spies.insertValues).toHaveBeenCalledWith({
      kind: "inbound",
      boxesDelta: 100,
      reason: "Shipment 23",
      sourceFormKind: "inbound",
      sourceFormId: 7n,
      productId,
      createdBy: actor.id,
    });

    expect(mocks.log).toHaveBeenCalledOnce();
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ledger.write",
        entityType: "stock_movement",
        entityId: "99",
        actorUserId: actor.id,
        payload: expect.objectContaining({
          kind: "inbound",
          boxesDelta: 100,
          reason: "Shipment 23",
          sourceFormKind: "inbound",
          sourceFormId: "7",
        }),
      }),
      undefined,
    );
  });

  it("forwards a passed-in transaction to both insert and audit log", async () => {
    const txInsertReturning = vi.fn(async () => [{ id: 11n }]);
    const txInsertValues = vi.fn(() => ({ returning: txInsertReturning }));
    const txInsert = vi.fn(() => ({ values: txInsertValues }));
    const tx = { insert: txInsert, select: vi.fn() } as unknown as Parameters<
      typeof recordMovement
    >[1];

    await recordMovement(
      { kind: "outbound", boxesDelta: -3, productId, actor },
      tx,
    );

    expect(txInsert).toHaveBeenCalledOnce();
    expect(mocks.spies.insert).not.toHaveBeenCalled();
    expect(mocks.log).toHaveBeenCalledOnce();
    expect(mocks.log).toHaveBeenCalledWith(expect.any(Object), tx);
  });
});

describe("getCurrentStock", () => {
  it("returns 0 when there are no movements", async () => {
    mocks.state.selectSumRows = [{ total: "0" }];
    expect(await getCurrentStock()).toBe(0);
  });

  it("parses the COALESCE(SUM) result into a number", async () => {
    mocks.state.selectSumRows = [{ total: "57" }];
    expect(await getCurrentStock()).toBe(57);
  });

  it("handles negative running balances (over-dispatched scenarios)", async () => {
    mocks.state.selectSumRows = [{ total: "-3" }];
    expect(await getCurrentStock()).toBe(-3);
  });
});

describe("getMovements", () => {
  it("rejects when from is after to", async () => {
    await expect(
      getMovements({
        from: new Date("2026-05-10"),
        to: new Date("2026-05-01"),
      }),
    ).rejects.toMatchObject({ code: "invalid_range" });
  });

  it("rejects invalid dates", async () => {
    await expect(
      getMovements({
        from: new Date("bad"),
        to: new Date("2026-05-13"),
      }),
    ).rejects.toMatchObject({ code: "invalid_range" });
  });

  it("returns the rows from the underlying query", async () => {
    const rows = [
      { id: 1n, kind: "inbound", boxesDelta: 100, createdAt: new Date() },
    ];
    mocks.state.selectMovementsRows = rows;
    const result = await getMovements({
      from: new Date("2026-05-01"),
      to: new Date("2026-05-13"),
    });
    expect(result).toEqual(rows);
  });

  it("caps limit at MAX_LIMIT and floors at 1", async () => {
    mocks.state.selectMovementsRows = [];
    await getMovements({
      from: new Date("2026-05-01"),
      to: new Date("2026-05-13"),
      limit: 99999,
    });
    expect(mocks.spies.limitFn).toHaveBeenLastCalledWith(1000);

    await getMovements({
      from: new Date("2026-05-01"),
      to: new Date("2026-05-13"),
      limit: -10,
    });
    expect(mocks.spies.limitFn).toHaveBeenLastCalledWith(1);
  });

  it("uses the default limit when none is provided", async () => {
    mocks.state.selectMovementsRows = [];
    await getMovements({
      from: new Date("2026-05-01"),
      to: new Date("2026-05-13"),
    });
    expect(mocks.spies.limitFn).toHaveBeenLastCalledWith(200);
  });

  it("uses the default limit for non-integer limits", async () => {
    mocks.state.selectMovementsRows = [];
    await getMovements({
      from: new Date("2026-05-01"),
      to: new Date("2026-05-13"),
      limit: 1.5,
    });
    expect(mocks.spies.limitFn).toHaveBeenLastCalledWith(200);
  });

  it("uses the default limit for null and undefined limits", async () => {
    mocks.state.selectMovementsRows = [];
    await getMovements({
      from: new Date("2026-05-01"),
      to: new Date("2026-05-13"),
      limit: undefined,
    });
    expect(mocks.spies.limitFn).toHaveBeenLastCalledWith(200);

    await getMovements({
      from: new Date("2026-05-01"),
      to: new Date("2026-05-13"),
      limit: null as unknown as number,
    });
    expect(mocks.spies.limitFn).toHaveBeenLastCalledWith(200);
  });
});

describe("StockLedgerError shape", () => {
  it("carries a stable code and message", () => {
    const err = new StockLedgerError("invalid_delta", "boom");
    expect(err.name).toBe("StockLedgerError");
    expect(err.code).toBe("invalid_delta");
    expect(err.message).toBe("boom");
  });
});
