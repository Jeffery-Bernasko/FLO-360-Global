import Link from "next/link";
import { dateInputValue, reportSearchParams, type DateRange } from "@/lib/reports";
import { IconDownload } from "@/components/icons";

export function ReportsHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="mb-6">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Reports
      </p>
      <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900">{title}</h1>
      <p className="mt-1 text-sm text-zinc-500">{description}</p>
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
    <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Report tabs">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-lg bg-white px-3.5 py-2 text-sm font-medium text-zinc-600 ring-1 ring-surface-border transition-colors hover:bg-teal-50 hover:text-teal-700"
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
    <form className="mb-4 grid gap-3 rounded-xl bg-white p-4 ring-1 ring-surface-border sm:grid-cols-[1fr_1fr_auto_auto]">
      <label className="block text-sm">
        <span className="font-medium text-zinc-700">From</span>
        <input
          type="date"
          name="from"
          defaultValue={dateInputValue(range.from)}
          className="mt-1.5 block w-full rounded-lg border border-surface-border px-3 py-2 text-sm focus-ring"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-zinc-700">To</span>
        <input
          type="date"
          name="to"
          defaultValue={dateInputValue(range.to)}
          className="mt-1.5 block w-full rounded-lg border border-surface-border px-3 py-2 text-sm focus-ring"
        />
      </label>
      {showKind ? (
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">Kind</span>
          <select
            name="kind"
            defaultValue={kind ?? "all"}
            className="mt-1.5 block w-full rounded-lg border border-surface-border px-3 py-2 text-sm focus-ring"
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
        className="self-end rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-800 focus-ring"
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
        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-600 ring-1 ring-surface-border transition-colors hover:bg-zinc-50"
      >
        <IconDownload width={14} height={14} />
        CSV
      </Link>
      <Link
        href={`${basePath}/export?${pdf.toString()}`}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-600 ring-1 ring-surface-border transition-colors hover:bg-zinc-50"
      >
        <IconDownload width={14} height={14} />
        PDF
      </Link>
    </div>
  );
}

export function EmptyReport() {
  return (
    <div className="flex flex-col items-center rounded-xl bg-white px-6 py-12 text-center ring-1 ring-surface-border">
      <p className="text-sm text-zinc-500">No rows found for this date range.</p>
    </div>
  );
}

export function ReportErrorMessage({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700 ring-1 ring-rose-200">
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
      <span className="text-zinc-500">
        Page {currentPage} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Link
          href={href(Math.max(1, currentPage - 1))}
          aria-disabled={currentPage <= 1}
          className="rounded-lg bg-white px-3 py-2 font-medium text-zinc-600 ring-1 ring-surface-border transition-colors hover:bg-zinc-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
        >
          Previous
        </Link>
        <Link
          href={href(Math.min(totalPages, currentPage + 1))}
          aria-disabled={currentPage >= totalPages}
          className="rounded-lg bg-white px-3 py-2 font-medium text-zinc-600 ring-1 ring-surface-border transition-colors hover:bg-zinc-50 aria-disabled:pointer-events-none aria-disabled:opacity-40"
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
