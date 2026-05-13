import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state: {
    inboundCount: number;
    outboundCount: number;
    currentStock: number;
    lastInboundWhereArg: unknown;
    lastOutboundWhereArg: unknown;
  } = {
    inboundCount: 0,
    outboundCount: 0,
    currentStock: 0,
    lastInboundWhereArg: null,
    lastOutboundWhereArg: null,
  };

  // `getPendingCounts` issues exactly two select chains per call, always in
  // the order: inbound, then outbound. Each call to db.select() corresponds
  // to one of those slots.
  let nextIsOutbound = false;

  const select = vi.fn(() => {
    const isOutbound = nextIsOutbound;
    nextIsOutbound = !nextIsOutbound;
    return {
      from: vi.fn(() => ({
        where: vi.fn((whereArg: unknown) => {
          if (isOutbound) state.lastOutboundWhereArg = whereArg;
          else state.lastInboundWhereArg = whereArg;
          return {
            then: (resolve: (rows: { c: string }[]) => void) =>
              resolve([
                {
                  c: String(
                    isOutbound ? state.outboundCount : state.inboundCount,
                  ),
                },
              ]),
          };
        }),
      })),
    };
  });

  return {
    state,
    db: { select },
    getCurrentStock: vi.fn(async () => state.currentStock),
  };
});

vi.mock("@/db", () => ({ db: mocks.db }));
vi.mock("@/lib/stock-ledger", () => ({
  getCurrentStock: mocks.getCurrentStock,
}));

import {
  getManagerDashboard,
  getPendingCounts,
  getWorkerDashboard,
} from "./dashboard";

beforeEach(() => {
  mocks.state.inboundCount = 0;
  mocks.state.outboundCount = 0;
  mocks.state.currentStock = 0;
  mocks.state.lastInboundWhereArg = null;
  mocks.state.lastOutboundWhereArg = null;
});

describe("getPendingCounts (manager / global)", () => {
  it("returns zeros when there's nothing pending", async () => {
    const r = await getPendingCounts();
    expect(r).toEqual({ inbound: 0, outbound: 0, total: 0 });
  });

  it("sums inbound and outbound counts", async () => {
    mocks.state.inboundCount = 2;
    mocks.state.outboundCount = 5;
    const r = await getPendingCounts();
    expect(r).toEqual({ inbound: 2, outbound: 5, total: 7 });
  });

  it("omits the 'mine' field in global mode", async () => {
    const r = await getPendingCounts();
    expect(r.mine).toBeUndefined();
  });
});

describe("getPendingCounts (scoped to user)", () => {
  it("populates 'mine' as the sum of the actor's pending forms", async () => {
    mocks.state.inboundCount = 1;
    mocks.state.outboundCount = 2;
    const r = await getPendingCounts({ scopedToUserId: "user-1" });
    expect(r.inbound).toBe(1);
    expect(r.outbound).toBe(2);
    expect(r.total).toBe(3);
    expect(r.mine).toBe(3);
  });

  it("passes a different where clause when scoped vs not", async () => {
    await getPendingCounts();
    const unscoped = mocks.state.lastInboundWhereArg;
    await getPendingCounts({ scopedToUserId: "user-1" });
    const scoped = mocks.state.lastInboundWhereArg;
    expect(scoped).not.toBe(unscoped);
    expect(scoped).toBeDefined();
  });
});

describe("getManagerDashboard", () => {
  it("returns current stock and global pending counts together", async () => {
    mocks.state.currentStock = 120;
    mocks.state.inboundCount = 1;
    mocks.state.outboundCount = 0;
    const r = await getManagerDashboard();
    expect(r.currentStock).toBe(120);
    expect(r.pending.total).toBe(1);
  });
});

describe("getWorkerDashboard", () => {
  it("returns current stock and the worker's own pending count", async () => {
    mocks.state.currentStock = 50;
    mocks.state.inboundCount = 2;
    mocks.state.outboundCount = 3;
    const r = await getWorkerDashboard("user-1");
    expect(r.currentStock).toBe(50);
    expect(r.myPending).toBe(5);
  });
});
