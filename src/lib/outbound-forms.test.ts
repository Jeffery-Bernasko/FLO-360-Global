import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state: {
    customerLookup: { id: string; isActive: boolean }[];
    customerFull: unknown[];
    stockSumRows: { total: string }[];
    formForUpdate: unknown[];
    insertReturning: unknown[];
    updateReturning: unknown[];
    nextValRows: { nextval: string | number }[];
  } = {
    customerLookup: [{ id: "c-1", isActive: true }],
    customerFull: [
      { id: "c-1", name: "Aba", phone: "0244", location: "Accra" },
    ],
    stockSumRows: [{ total: "1000" }],
    formForUpdate: [],
    insertReturning: [],
    updateReturning: [],
    nextValRows: [{ nextval: "1" }],
  };

  // Select dispatch:
  //  - select({id, isActive})         → customers lookup (active-check)
  //  - select({total: <sql>})         → stock sum
  //  - select() then .for("update")   → form-for-update
  //  - select() with no .for()        → customer full row (after the form
  //                                     row has been loaded inside approve)
  let noArgSelectSawForUpdate = false;

  const select = vi.fn((fields?: Record<string, unknown>) => {
    const noArg = !fields;
    const isCustomerLookup =
      !!fields &&
      "isActive" in fields &&
      "id" in fields &&
      Object.keys(fields).length === 2;
    const isStockSum = !!fields && "total" in fields;

    if (noArg) noArgSelectSawForUpdate = false;

    const fromBuilder = {
      where: vi.fn(() => ({
        limit: vi.fn(async () => {
          if (isCustomerLookup) return state.customerLookup;
          if (isStockSum) return state.stockSumRows;
          return noArgSelectSawForUpdate
            ? state.formForUpdate
            : state.customerFull;
        }),
        for: vi.fn(() => {
          noArgSelectSawForUpdate = true;
          return {
            limit: vi.fn(async () => state.formForUpdate),
          };
        }),
      })),
      // For the stock-sum query, `await select(...).from(...)` resolves
      // directly without where()/limit().
      then: isStockSum
        ? (resolve: (rows: unknown) => void) => resolve(state.stockSumRows)
        : undefined,
    };

    return { from: vi.fn(() => fromBuilder) };
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

  const execute = vi.fn(async () => ({ rows: state.nextValRows }));

  const db = {
    select,
    insert,
    update,
    execute,
    transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(db)),
  };

  return {
    state,
    db,
    log: vi.fn().mockResolvedValue(undefined),
    recordMovement: vi.fn().mockResolvedValue({ id: 99n }),
    renderInvoicePdfBuffer: vi
      .fn()
      .mockResolvedValue(Buffer.from("pdf bytes")),
    put: vi.fn().mockResolvedValue({ url: "https://blob.example/x.pdf" }),
    getCurrentStock: vi.fn().mockResolvedValue(1000),
  };
});

vi.mock("@/db", () => ({ db: mocks.db }));
vi.mock("@/audit", () => ({ log: mocks.log }));
vi.mock("@/lib/stock-ledger", () => ({
  recordMovement: mocks.recordMovement,
  getCurrentStock: mocks.getCurrentStock,
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
  rejectOutbound,
  submitOutbound,
} from "./outbound-forms";

const worker = { id: "wkr-1", role: "worker" as const };
const manager = { id: "mgr-1", role: "manager" as const };

beforeEach(() => {
  mocks.state.customerLookup = [{ id: "c-1", isActive: true }];
  mocks.state.customerFull = [
    { id: "c-1", name: "Aba", phone: "0244", location: "Accra" },
  ];
  mocks.state.stockSumRows = [{ total: "1000" }];
  mocks.state.formForUpdate = [];
  mocks.state.insertReturning = [];
  mocks.state.updateReturning = [];
  mocks.state.nextValRows = [{ nextval: "1" }];
  mocks.log.mockClear();
  mocks.recordMovement.mockClear();
  mocks.renderInvoicePdfBuffer.mockClear();
  mocks.put.mockClear();
  mocks.db.transaction.mockClear();
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
});

const validInput = {
  actor: worker,
  customerId: "11111111-1111-1111-1111-111111111111",
  boxes: 30,
  unitPricePesewas: 5000,
  dispatchDate: "2026-05-13",
};

describe("submitOutbound", () => {
  it("rejects invalid customer id", async () => {
    await expect(
      submitOutbound({ ...validInput, customerId: "x" }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("rejects non-positive boxes or price", async () => {
    await expect(
      submitOutbound({ ...validInput, boxes: 0 }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      submitOutbound({ ...validInput, unitPricePesewas: 0 }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("rejects inactive or missing customer", async () => {
    mocks.state.customerLookup = [];
    await expect(submitOutbound(validInput)).rejects.toMatchObject({
      code: "invalid_customer",
    });
  });

  it("rejects when boxes exceed current stock", async () => {
    mocks.state.stockSumRows = [{ total: "10" }];
    await expect(
      submitOutbound({ ...validInput, boxes: 100 }),
    ).rejects.toMatchObject({ code: "insufficient_stock" });
  });

  it("creates the form and audits", async () => {
    mocks.state.insertReturning = [
      {
        id: 3n,
        customerId: validInput.customerId,
        boxes: 30,
        unitPricePesewas: 5000,
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
      { id: 1n, status: "approved", boxes: 30, unitPricePesewas: 5000 },
    ];
    await expect(
      approveOutbound({ actor: manager, formId: 1n }),
    ).rejects.toMatchObject({ code: "not_pending" });
  });

  it("rejects when stock dropped below the form's boxes between submit and approve", async () => {
    mocks.state.formForUpdate = [
      {
        id: 1n,
        status: "pending",
        customerId: "c-1",
        boxes: 50,
        unitPricePesewas: 5000,
      },
    ];
    mocks.state.stockSumRows = [{ total: "10" }];

    await expect(
      approveOutbound({ actor: manager, formId: 1n }),
    ).rejects.toMatchObject({ code: "insufficient_stock" });
    expect(mocks.recordMovement).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("rejects when blob is not configured", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    mocks.state.formForUpdate = [
      {
        id: 1n,
        status: "pending",
        customerId: "c-1",
        boxes: 30,
        unitPricePesewas: 5000,
      },
    ];
    mocks.state.customerFull = [
      { id: "c-1", name: "Aba", phone: null, location: null },
    ];
    mocks.state.stockSumRows = [{ total: "1000" }];

    await expect(
      approveOutbound({ actor: manager, formId: 1n }),
    ).rejects.toMatchObject({ code: "blob_not_configured" });
  });

  it("happy path: deducts stock, claims invoice, renders PDF, uploads, and audits", async () => {
    mocks.state.formForUpdate = [
      {
        id: 1n,
        status: "pending",
        customerId: "c-1",
        boxes: 30,
        unitPricePesewas: 5000,
      },
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

describe("OutboundFormError shape", () => {
  it("carries a stable code", () => {
    const err = new OutboundFormError("insufficient_stock", "boom");
    expect(err.code).toBe("insufficient_stock");
    expect(err.name).toBe("OutboundFormError");
  });
});
