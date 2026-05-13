import { formatGhsPlain } from "@/lib/money";
import {
  type DateRange,
  type PerCustomerRow,
  type PerSupplierRow,
  type StockMovementRow,
} from "@/lib/reports";

type CsvCell = string | number | null | undefined;

function quoteCell(value: CsvCell): string {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(headers: string[], rows: CsvCell[][]): string {
  return [
    headers.map(quoteCell).join(","),
    ...rows.map((row) => row.map(quoteCell).join(",")),
  ].join("\r\n");
}

function dateTime(value: Date | null): string {
  return value ? value.toISOString() : "";
}

export function csvResponse(body: string, filename: string): Response {
  return new Response(`\uFEFF${body}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export function stockMovementCsv(rows: StockMovementRow[]): string {
  return toCsv(
    [
      "Date",
      "Kind",
      "Party",
      "Boxes",
      "Unit price GHS",
      "Total GHS",
      "Reason",
      "Running balance",
      "Recorded by",
    ],
    rows.map((row) => [
      dateTime(row.createdAt),
      row.kind,
      row.partyName,
      row.boxesDelta,
      row.unitPricePesewas == null ? "" : formatGhsPlain(row.unitPricePesewas),
      row.totalPesewas == null ? "" : formatGhsPlain(row.totalPesewas),
      row.reason,
      row.runningBalance,
      row.actorName,
    ]),
  );
}

export function perCustomerCsv(rows: PerCustomerRow[]): string {
  return toCsv(
    [
      "Customer",
      "Location",
      "Total boxes",
      "Total GHS",
      "Dispatches",
      "Last dispatch",
    ],
    rows.map((row) => [
      row.customerName,
      row.customerLocation,
      row.totalBoxes,
      formatGhsPlain(row.totalPesewas),
      row.dispatchCount,
      dateTime(row.lastDispatchAt),
    ]),
  );
}

export function perSupplierCsv(rows: PerSupplierRow[]): string {
  return toCsv(
    ["Supplier", "Country", "Total boxes", "Shipments", "Last received"],
    rows.map((row) => [
      row.supplierName,
      row.country,
      row.totalBoxes,
      row.shipmentCount,
      dateTime(row.lastReceivedAt),
    ]),
  );
}

export function rangeLabel(range: DateRange): string {
  return `${range.from.toISOString().slice(0, 10)} to ${range.to
    .toISOString()
    .slice(0, 10)}`;
}
