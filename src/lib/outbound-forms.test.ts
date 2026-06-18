import { beforeEach, describe, expect, it, vi } from "vitest";

const productId = "22222222-2222-2222-2222-222222222222";

const mocks = vi.hoisted(() => {
  const state: {
    customerLookup: { id: string; isActive: boolean }[];
    productLookup: { id: string; isActive: boolean }[];
    customerFull: unknown[];
    formForUpdate: unknown[];
    insertReturning: unknown[];
    updateReturning: unknown[];
    selectLinesReturning: unknown[];
    nextValRows: { nextval: string | number }[];
  } = {
    customerLookup: [{ id: "c-1", isActive: true }],
    productLookup: [{ id: "22222222-2222-2222-2222-222222222222", isActive: true }],
    customerFull: [
      { id: "c-1", name: "Aba", phone: "0244", location: "Accra" },
    ],
    formForUpdate: [],
    insertReturning: [],
    updateReturning: [],
    selectLinesReturning: [],
    nextValRows: [{ nextval: "1" }],
  };

  // Track which table/mode is being queried.
  let lastSelectMode: "customer" | "product" | "form" | "lines" = "customer";

  const select = vi.fn((fields?: unknown) => {
    if (!fields) {
      lastSelectMode = "form";
    }
    return {
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => {
            if (fields && lastSelectMode === "customer") {
              const result = state.customerLookup;
              lastSelectMode = "product";
              return result;
            }
            if (fields) {
              return state.productLookup;
            }
            return state.formForUpdate;
          }),
          for: vi.fn(() => ({
            limit: vi.fn(async () => state.formForUpdate),
          })),
        })),
        innerJoin: vi.fn(() => ({
          where: vi.fn(async () => state.selectLinesReturning),
        })),
        leftJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => []),
          })),
        })),
        // For the stock-sum query.
        then: (resolve: (rows: unknown) => void) =>
          resolve([{ total: "1000" }]),
      })),
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

  const execute = vi.fn(async () => ({ rows: state.nextValRows }));

  const db = {
    select,
    insert,
    update,
    delete: deleteFn,
    execute,
    transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(db)),
  };

  return {
    state,
    resetSelectMode: () => {
      lastSelectMode = "customer";
    },
    db,
    log: vi.fn().mockResolvedValue(undefined),
    recordMovement: vi.fn().mockResolvedValue({ id: 99n }),
    getStockForProduct: vi.fn().mockResolvedValue(1000),
    renderInvoicePdfBuffer: vi
      .fn()
      .mockResolvedValue(Buffer.from("pdf bytes")),
    put: vi.fn().mockResolvedValue({ url: "https://blob.example/x.pdf" }),
  };
});

vi.mock("@/db", () => ({ db: mocks.db }));
vi.mock("@/audit", () => ({ log: mocks.log }));
vi.mock("@/lib/stock-ledger", () => ({
  recordMovement: mocks.recordMovement,
  getStockForProduct: mocks.getStockForProduct,
}));
vi.mock("@/lib/invoice-pdf", () => ({
  renderInvoicePdfBuffer: mocks.renderInvoicePdfBuffer,
}));
vi.mock("@vercel/blob", () => ({
  put: mocks.put,
}));

import {
  OutboundFormError,
  approveOutbound,
  editAndResubmitOutbound,
  rejectOutbound,
  submitOutbound,
} from "./outbound-forms";

const worker = { id: "wkr-1", role: "worker" as const };
const otherWorker = { id: "wkr-2", role: "worker" as const };
const manager = { id: "mgr-1", role: "manager" as const };

beforeEach(() => {
  mocks.state.customerLookup = [{ id: "c-1", isActive: true }];
  mocks.state.productLookup = [{ id: productId, isActive: true }];
  mocks.state.customerFull = [
    { id: "c-1", name: "Aba", phone: "0244", location: "Accra" },
  ];
  mocks.state.formForUpdate = [];
  mocks.state.insertReturning = [];
  mocks.state.updateReturning = [];
  mocks.state.selectLinesReturning = [];
  mocks.state.nextValRows = [{ nextval: "1" }];
  mocks.resetSelectMode();
  mocks.log.mockClear();
  mocks.recordMovement.mockClear();
  mocks.getStockForProduct.mockClear();
  mocks.getStockForProduct.mockResolvedValue(1000);
  mocks.renderInvoicePdfBuffer.mockClear();
  mocks.put.mockClear();
  mocks.db.transaction.mockClear();
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
});

const validInput = {
  actor: worker,
  customerId: "11111111-1111-1111-1111-111111111111",
  lines: [{ productId, boxes: 30, unitPricePesewas: 5000 }],
  dispatchDate: "2026-05-13",
};

describe("submitOutbound", () => {
  it("rejects invalid customer id", async () => {
    await expect(
      submitOutbound({ ...validInput, customerId: "x" }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("rejects empty lines array", async () => {
    await expect(
      submitOutbound({ ...validInput, lines: [] }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("rejects zero or negative boxes", async () => {
    await expect(
      submitOutbound({
        ...validInput,
        lines: [{ productId, boxes: 0, unitPricePesewas: 5000 }],
      }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("rejects duplicate products in lines", async () => {
    await expect(
      submitOutbound({
        ...validInput,
        lines: [
          { productId, boxes: 10, unitPricePesewas: 5000 },
          { productId, boxes: 20, unitPricePesewas: 3000 },
        ],
      }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("creates the form and audits", async () => {
    mocks.state.insertReturning = [
      {
        id: 3n,
        customerId: validInput.customerId,
        boxes: 30,
        unitPricePesewas: 5000,
        totalPesewas: 150000,
        dispatchDate: "2026-05-13",
        status: "pending",
      },
    ];

    const created = await submitOutbound(validInput);
    expect(created.id).toBe(3n);
    expect(mocks.db.transaction).toHaveBeenCalledOnce();
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "form.submit",
        entityType: "outbound_form",
        entityId: "3",
      }),
      expect.anything(),
    );
    expect(mocks.recordMovement).not.toHaveBeenCalled();
  });
});

describe("rejectOutbound", () => {
  it("rejects when called by a worker", async () => {
    await expect(
      rejectOutbound({ actor: worker, formId: 1n, reason: "x" }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rejects empty reason", async () => {
    await expect(
      rejectOutbound({ actor: manager, formId: 1n, reason: "  " }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("rejects when form not found", async () => {
    mocks.state.formForUpdate = [];
    await expect(
      rejectOutbound({ actor: manager, formId: 1n, reason: "wrong" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("rejects when form not pending", async () => {
    mocks.state.formForUpdate = [{ id: 1n, status: "approved" }];
    await expect(
      rejectOutbound({ actor: manager, formId: 1n, reason: "wrong" }),
    ).rejects.toMatchObject({ code: "not_pending" });
  });

  it("happy path: flips to rejected, writes audit, no stock movement", async () => {
    mocks.state.formForUpdate = [{ id: 1n, status: "pending" }];
    mocks.state.updateReturning = [
      { id: 1n, status: "rejected", decisionReason: "wrong" },
    ];

    await rejectOutbound({ actor: manager, formId: 1n, reason: "wrong" });

    expect(mocks.recordMovement).not.toHaveBeenCalled();
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "form.reject",
        entityType: "outbound_form",
        payload: { reason: "wrong" },
      }),
      expect.anything(),
    );
  });
});

describe("approveOutbound", () => {
  it("rejects when called by a worker", async () => {
    await expect(
      approveOutbound({ actor: worker, formId: 1n }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rejects when form not found", async () => {
    mocks.state.formForUpdate = [];
    await expect(
      approveOutbound({ actor: manager, formId: 1n }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(mocks.recordMovement).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("rejects when form not pending", async () => {
    mocks.state.formForUpdate = [
      { id: 1n, status: "approved", boxes: 30, unitPricePesewas: 5000, totalPesewas: 150000 },
    ];
    await expect(
      approveOutbound({ actor: manager, formId: 1n }),
    ).rejects.toMatchObject({ code: "not_pending" });
  });

  it("happy path: records per-line movement, renders PDF, and audits", async () => {
    mocks.state.formForUpdate = [
      {
        id: 1n,
        status: "pending",
        customerId: "c-1",
        boxes: 30,
        unitPricePesewas: 5000,
        totalPesewas: 150000,
      },
    ];
    mocks.state.selectLinesReturning = [
      { id: 1n, formId: 1n, productId, boxes: 30, unitPricePesewas: 5000, productName: "Default" },
    ];
    mocks.state.customerFull = [
      { id: "c-1", name: "Aba", phone: null, location: "Accra" },
    ];
    mocks.state.updateReturning = [
      {
        id: 1n,
        status: "approved",
        invoiceNumber: 1n,
      },
    ];
    mocks.state.nextValRows = [{ nextval: "1" }];

    await approveOutbound({ actor: manager, formId: 1n });

    expect(mocks.recordMovement).toHaveBeenCalledOnce();
    expect(mocks.recordMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "outbound",
        boxesDelta: -30,
        sourceFormKind: "outbound",
        sourceFormId: 1n,
        productId,
      }),
      expect.anything(),
    );
    expect(mocks.renderInvoicePdfBuffer).toHaveBeenCalledOnce();
    expect(mocks.put).toHaveBeenCalledOnce();
    expect(mocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "form.approve",
        entityType: "outbound_form",
        entityId: "1",
      }),
      expect.anything(),
    );
  });
});

describe("editAndResubmitOutbound", () => {
  it("rejects when not the original creator", async () => {
    mocks.state.formForUpdate = [
      {
        id: 1n,
        status: "rejected",
        createdBy: worker.id,
        customerId: "c-1",
        boxes: 5,
        totalPesewas: 25000,
      },
    ];
    // Use select().from().where().limit() path for existing form lookup
    await expect(
      editAndResubmitOutbound({
        ...validInput,
        formId: 1n,
        actor: otherWorker,
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rejects when form is not in rejected state", async () => {
    mocks.state.formForUpdate = [
      {
        id: 1n,
        status: "pending",
        createdBy: worker.id,
        customerId: "c-1",
        boxes: 5,
        totalPesewas: 25000,
      },
    ];
    await expect(
      editAndResubmitOutbound({
        ...validInput,
        formId: 1n,
        actor: worker,
      }),
    ).rejects.toMatchObject({ code: "not_editable" });
  });

  it("happy path: flips status back to pending, audits", async () => {
    mocks.state.formForUpdate = [
      {
        id: 1n,
        status: "rejected",
        createdBy: worker.id,
        customerId: "c-1",
        boxes: 5,
        totalPesewas: 25000,
      },
    ];
    mocks.state.updateReturning = [
      {
        id: 1n,
        status: "pending",
        customerId: validInput.customerId,
        boxes: 30,
        totalPesewas: 150000,
      },
    ];

    await editAndResubmitOutbound({
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

describe("OutboundFormError shape", () => {
  it("carries a stable code", () => {
    const err = new OutboundFormError("insufficient_stock", "boom");
    expect(err.code).toBe("insufficient_stock");
    expect(err.name).toBe("OutboundFormError");
  });
});
