import { describe, expect, it } from "vitest";
import {
  perCustomerCsv,
  perSupplierCsv,
  stockMovementCsv,
} from "./report-csv";

describe("report CSV serializers", () => {
  it("quotes commas, quotes, and newlines for stock movements", () => {
    const csv = stockMovementCsv([
      {
        id: "1",
        createdAt: new Date("2026-05-13T10:00:00.000Z"),
        kind: "adjustment",
        boxesDelta: -2,
        reason: 'Damaged, "wet"\nwarehouse',
        sourceFormKind: null,
        sourceFormId: null,
        productName: "Default Product",
        partyName: null,
        unitPricePesewas: null,
        totalPesewas: null,
        actorName: "Manager",
        runningBalance: 58,
      },
    ]);

    expect(csv).toContain('"Damaged, ""wet""\nwarehouse"');
    expect(csv).toContain('"58"');
  });

  it("exports customer money in plain accounting format", () => {
    const csv = perCustomerCsv([
      {
        customerId: "customer-1",
        customerName: "Awa Stores",
        customerLocation: "Accra",
        totalBoxes: 12,
        totalPesewas: 123450,
        dispatchCount: 3,
        lastDispatchAt: new Date("2026-05-12T12:00:00.000Z"),
      },
    ]);

    expect(csv).toContain('"1234.50"');
    expect(csv).toContain('"Awa Stores"');
  });

  it("exports supplier totals", () => {
    const csv = perSupplierCsv([
      {
        supplierId: "supplier-1",
        supplierName: "Global Supply",
        country: "China",
        totalBoxes: 240,
        shipmentCount: 2,
        lastReceivedAt: new Date("2026-05-11T12:00:00.000Z"),
      },
    ]);

    expect(csv).toContain('"Global Supply"');
    expect(csv).toContain('"240"');
  });

  it("neutralizes spreadsheet formulas in exported cells", () => {
    const csv = perCustomerCsv([
      {
        customerId: "customer-2",
        customerName: "=cmd|' /C calc'!A0",
        customerLocation: "@danger",
        totalBoxes: 1,
        totalPesewas: 100,
        dispatchCount: 1,
        lastDispatchAt: new Date("2026-05-12T12:00:00.000Z"),
      },
    ]);

    expect(csv).toContain("\"'=cmd|' /C calc'!A0\"");
    expect(csv).toContain("\"'@danger\"");
  });
});
