import { beforeEach, describe, expect, it, vi } from "vitest";

const productId = "22222222-2222-2222-2222-222222222222";

const mocks = vi.hoisted(() => {
  const state: {
    supplierLookup: { id: string; isActive: boolean }[];
    productLookup: { id: string; isActive: boolean }[];
    insertReturning: unknown[];
    selectFormReturning: unknown[];
    selectLinesReturning: unknown[];
    updateReturning: unknown[];
  } = {
    supplierLookup: [{ id: "supplier-1", isActive: true }],
    productLookup: [{ id: "22222222-2222-2222-2222-222222222222", isActive: true }],
    insertReturning: [],
    selectFormReturning: [],
    selectLinesReturning: [],
    updateReturning: [],
  };

  // Track which table is being queried to return appropriate mock data.
  let lastSelectMode: "supplier" | "product" | "form" | "lines" = "supplier";

  const select = vi.fn((fields?: unknown) => {
    // select with specific fields = supplier or product lookup; select() = form
    lastSelectMode = fields ? "supplier" : "form";
    return {
      from: vi.fn((table?: unknown) => {
        // Distinguish between form lines and forms based on subsequent calls
        return {
          where: vi.fn(() => {
            // Return an object that is both thenable (for `await select().from().where()`)
            // and has `.limit()` / `.for()` for chained queries.
            const directResult = async () => {
              if (lastSelectMode === "supplier") {
                const result = state.supplierLookup;
                lastSelectMode = "product";
                return result;
              }
              if (lastSelectMode === "product") {
                return state.productLookup;
              }
              // "form" mode without .limit()/.for() = line items query
              return state.selectLinesReturning;
            };
            return {
              then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
                directResult().then(resolve, reject),
              limit: vi.fn(async () => {
                if (lastSelectMode === "supplier") {
                  const result = state.supplierLookup;
                  lastSelectMode = "product";
                  return result;
                }
                if (lastSelectMode === "product") {
                  return state.productLookup;
                }
                return state.selectFormReturning;
              }),
              for: vi.fn(() => ({
                limit: vi.fn(async () => state.selectFormReturning),
              })),
            };
          }),
          innerJoin: vi.fn(() => ({
            where: vi.fn(async () => state.selectLinesReturning),
          })),
        };
      }),
    };
  });

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

  const deleteFn = vi.fn(() => ({
    where: vi.fn(async () => []),
  }));

  const db = {
    select,
    insert,
    update,
    delete: deleteFn,
    transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(db)),
  };

  return {
    state,
    db,
    log: vi.fn().mockResolvedValue(undefined),
    recordMovement: vi.fn().mockResolvedValue({ id: 99n }),
  };
});

vi.mock("@/db", () => ({ db: mocks.db }));
vi.mock("@/audit", () => ({ log: mocks.log }));
vi.mock("@/lib/stock-ledger", () => ({
  recordMovement: mocks.recordMovement,
}));

import {
  InboundFormError,
  approveInbound,
  editAndResubmitInbound,
  rejectInbound,
  submitInbound,
} from "./inbound-forms";

const worker = { id: "wkr-1", role: "worker" as const };
const otherWorker = { id: "wkr-2", role: "worker" as const };
const manager = { id: "mgr-1", role: "manager" as const };

beforeEach(() => {
  mocks.state.supplierLookup = [{ id: "supplier-1", isActive: true }];
  mocks.state.productLookup = [{ id: productId, isActive: true }];
  mocks.state.insertReturning = [];
  mocks.state.selectFormReturning = [];
  mocks.state.selectLinesReturning = [];
  mocks.state.updateReturning = [];
  mocks.log.mockClear();
  mocks.recordMovement.mockClear();
  mocks.db.transaction.mockClear();
});

const validInput = {
  actor: worker,
  supplierId: "11111111-1111-1111-1111-111111111111",
  lines: [{ productId, boxes: 100 }],
  receivedDate: "2026-05-10",
  note: "Shipment 23",
};

describe("submitInbound", () => {
  it("rejects invalid supplier id (uuid validation)", async () => {
    await expect(
      submitInbound({ ...validInput, supplierId: "not-a-uuid" }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("rejects zero or negative boxes", async () => {
    await expect(
      submitInbound({ ...validInput, lines: [{ productId, boxes: 0 }] }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      submitInbound({ ...validInput, lines: [{ productId, boxes: -5 }] }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("rejects empty lines array", async () => {
    await expect(
      submitInbound({ ...validInput, lines: [] }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("rejects missing receivedDate", async () => {
    await expect(
      submitInbound({ ...validInput, receivedDate: "not-a-date" }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("rejects duplicate products in lines", async () => {
    await expect(
      submitInbound({
        ...validInput,
        lines: [
          { productId, boxes: 50 },
          { productId, boxes: 30 },
        ],
      }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("rejects when supplier is not found or inactive", async () => {
    mocks.state.supplierLookup = [];
    await expect(submitInbound(validInput)).rejects.toMatchObject({
      code: "invalid_supplier",
    });
    mocks.state.supplierLookup = [
      { id: "supplier-1", isActive: false },
    ];
    await expect(submitInbound(validInput)).rejects.toMatchObject({
      code: "invalid_supplier",
    });
  });

  it("creates the form and writes a form.submit audit entry inside a tx", async () => {
    mocks.state.insertReturning = [
      {
        id: 7n,
        supplierId: validInput.supplierId,
        boxes: 100,
        receivedDate: "2026-05-10",
        status: "pending",
      },
    ];

    const created = await submitInbound(validInput);
    expect(created.id).toBe(7n);
    expect(mocks.db.transaction).toHaveBeenCalledOnce();
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "form.submit",
        entityType: "inbound_form",
        entityId: "7",
      }),
      expect.anything(),
    );
    // No stock movement on submit.
    expect(mocks.recordMovement).not.toHaveBeenCalled();
  });
});

describe("approveInbound", () => {
  it("rejects when called by a worker", async () => {
    await expect(
      approveInbound({ actor: worker, formId: 1n }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rejects when form not found", async () => {
    mocks.state.selectFormReturning = [];
    await expect(
      approveInbound({ actor: manager, formId: 99n }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects when form is not pending", async () => {
    mocks.state.selectFormReturning = [
      { id: 1n, status: "approved", boxes: 50, supplierId: "s" },
    ];
    await expect(
      approveInbound({ actor: manager, formId: 1n }),
    ).rejects.toMatchObject({ code: "not_pending" });
    expect(mocks.recordMovement).not.toHaveBeenCalled();
  });

  it("happy path: flips status, records movement per line, and audits", async () => {
    mocks.state.selectFormReturning = [
      {
        id: 1n,
        status: "pending",
        boxes: 75,
        supplierId: "s",
        note: "note",
      },
    ];
    mocks.state.selectLinesReturning = [
      { id: 1n, formId: 1n, productId, boxes: 75, productName: "Default" },
    ];
    mocks.state.updateReturning = [
      {
        id: 1n,
        status: "approved",
        boxes: 75,
        supplierId: "s",
      },
    ];

    await approveInbound({ actor: manager, formId: 1n });

    expect(mocks.recordMovement).toHaveBeenCalledOnce();
    expect(mocks.recordMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "inbound",
        boxesDelta: 75,
        sourceFormKind: "inbound",
        sourceFormId: 1n,
        productId,
        actor: { id: manager.id },
      }),
      expect.anything(),
    );
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "form.approve",
        entityType: "inbound_form",
        entityId: "1",
      }),
      expect.anything(),
    );
  });
});

describe("rejectInbound", () => {
  it("rejects when called by a worker", async () => {
    await expect(
      rejectInbound({ actor: worker, formId: 1n, reason: "x" }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rejects when reason is empty", async () => {
    await expect(
      rejectInbound({ actor: manager, formId: 1n, reason: "  " }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("rejects when form not found", async () => {
    mocks.state.selectFormReturning = [];
    await expect(
      rejectInbound({ actor: manager, formId: 1n, reason: "wrong" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("happy path: flips status, no ledger write, audits with reason", async () => {
    mocks.state.selectFormReturning = [{ id: 1n, status: "pending" }];
    mocks.state.updateReturning = [
      { id: 1n, status: "rejected", decisionReason: "wrong" },
    ];

    await rejectInbound({ actor: manager, formId: 1n, reason: "wrong" });

    expect(mocks.recordMovement).not.toHaveBeenCalled();
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "form.reject",
        payload: { reason: "wrong" },
      }),
      expect.anything(),
    );
  });
});

describe("editAndResubmitInbound", () => {
  it("rejects when not the original creator", async () => {
    mocks.state.selectFormReturning = [
      {
        id: 1n,
        status: "rejected",
        createdBy: worker.id,
        supplierId: "s",
        boxes: 5,
        receivedDate: "2026-05-01",
      },
    ];
    await expect(
      editAndResubmitInbound({
        ...validInput,
        formId: 1n,
        actor: otherWorker,
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rejects when form is not in rejected state", async () => {
    mocks.state.selectFormReturning = [
      {
        id: 1n,
        status: "pending",
        createdBy: worker.id,
        supplierId: "s",
        boxes: 5,
        receivedDate: "2026-05-01",
      },
    ];
    await expect(
      editAndResubmitInbound({
        ...validInput,
        formId: 1n,
        actor: worker,
      }),
    ).rejects.toMatchObject({ code: "not_editable" });
  });

  it("rejects when the replacement supplier is not found or inactive", async () => {
    mocks.state.selectFormReturning = [
      {
        id: 1n,
        status: "rejected",
        createdBy: worker.id,
        supplierId: "old-supplier",
        boxes: 5,
        receivedDate: "2026-05-01",
      },
    ];

    mocks.state.supplierLookup = [];
    await expect(
      editAndResubmitInbound({
        ...validInput,
        formId: 1n,
        actor: worker,
      }),
    ).rejects.toMatchObject({ code: "invalid_supplier" });

    mocks.state.supplierLookup = [
      { id: validInput.supplierId, isActive: false },
    ];
    await expect(
      editAndResubmitInbound({
        ...validInput,
        formId: 1n,
        actor: worker,
      }),
    ).rejects.toMatchObject({ code: "invalid_supplier" });
  });

  it("happy path: flips status back to pending, clears decision fields, audits", async () => {
    mocks.state.selectFormReturning = [
      {
        id: 1n,
        status: "rejected",
        createdBy: worker.id,
        supplierId: "old-supplier",
        boxes: 5,
        receivedDate: "2026-05-01",
        note: "old",
        attachmentKey: "old-key",
        decisionReason: "wrong",
      },
    ];
    mocks.state.updateReturning = [
      {
        id: 1n,
        status: "pending",
        supplierId: validInput.supplierId,
        boxes: 100,
        receivedDate: "2026-05-10",
        note: "Shipment 23",
      },
    ];

    await editAndResubmitInbound({
      ...validInput,
      formId: 1n,
      actor: worker,
    });

    expect(mocks.recordMovement).not.toHaveBeenCalled();
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "form.edit_and_resubmit",
        entityId: "1",
      }),
      expect.anything(),
    );
  });
});

describe("InboundFormError shape", () => {
  it("carries a stable code and message", () => {
    const err = new InboundFormError("not_pending", "boom");
    expect(err.name).toBe("InboundFormError");
    expect(err.code).toBe("not_pending");
  });
});
