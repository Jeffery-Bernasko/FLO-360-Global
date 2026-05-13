import Link from "next/link";
import { dateInputValue, reportSearchParams, type DateRange } from "@/lib/reports";

export function ReportsHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Reports
      </p>
      <h1 className="text-xl font-semibold text-slate-950">{title}</h1>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </header>
  );
}

export function ReportTabs() {
  const links = [
    { href: "/reports/movements", label: "Stock movement" },
    { href: "/reports/customers", label: "Customers" },
    { href: "/reports/suppliers", label: "Suppliers" },
  ];

  return (
    <nav className="mb-4 flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function DateRangeForm({
  range,
  kind,
  showKind = false,
}: {
  range: DateRange;
  kind?: string;
  showKind?: boolean;
}) {
  return (
    <form className="mb-4 grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:grid-cols-[1fr_1fr_auto_auto]">
      <label className="block text-sm">
        <span className="font-medium text-slate-700">From</span>
        <input
          type="date"
          name="from"
          defaultValue={dateInputValue(range.from)}
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-slate-700">To</span>
        <input
          type="date"
          name="to"
          defaultValue={dateInputValue(range.to)}
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
        />
      </label>
      {showKind ? (
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Kind</span>
          <select
            name="kind"
            defaultValue={kind ?? "all"}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
          >
            <option value="all">All</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
            <option value="adjustment">Adjustment</option>
          </select>
        </label>
      ) : null}
      <button
        type="submit"
        className="self-end rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
      >
        Apply
      </button>
    </form>
  );
}

export function ExportLinks({
  basePath,
  range,
  kind,
}: {
  basePath: string;
  range: DateRange;
  kind?: "inbound" | "outbound" | "adjustment" | "all";
}) {
  const params = reportSearchParams(range, kind);
  const csv = new URLSearchParams(params);
  csv.set("format", "csv");
  const pdf = new URLSearchParams(params);
  pdf.set("format", "pdf");

  return (
    <div className="mb-4 flex justify-end gap-2">
      <Link
        href={`${basePath}/export?${csv.toString()}`}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        CSV
      </Link>
      <Link
        href={`${basePath}/export?${pdf.toString()}`}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        PDF
      </Link>
    </div>
  );
}

export function EmptyReport() {
  return (
    <div className="rounded-2xl bg-white p-6 text-sm text-slate-500 ring-1 ring-slate-200">
      No rows found for this date range.
    </div>
  );
}

export function ReportErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200">
      {message}
    </div>
  );
}

export function PaginationLinks({
  basePath,
  currentPage,
  totalRows,
  pageSize,
  range,
  kind,
}: {
  basePath: string;
  currentPage: number;
  totalRows: number;
  pageSize: number;
  range: DateRange;
  kind?: "inbound" | "outbound" | "adjustment" | "all";
}) {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  if (totalPages <= 1) return null;

  function href(page: number) {
    const params = reportSearchParams(range, kind);
    params.set("page", String(page));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <span className="text-slate-500">
        Page {currentPage} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Link
          href={href(Math.max(1, currentPage - 1))}
          aria-disabled={currentPage <= 1}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          Previous
        </Link>
        <Link
          href={href(Math.min(totalPages, currentPage + 1))}
          aria-disabled={currentPage >= totalPages}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          Next
        </Link>
      </div>
    </div>
  );
}

export function parsePage(value: string | undefined, totalRows: number, pageSize: number) {
  const requested = Number(value ?? "1");
  const page = Number.isInteger(requested) && requested > 0 ? requested : 1;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  return Math.min(page, totalPages);
}
