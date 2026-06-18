import { redirect } from "next/navigation";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { requireManager } from "@/auth-server";
import { AppShell } from "@/components/app-shell";
import { ReportError, parseReportParams, perSupplierReport } from "@/lib/reports";
import {
  DateRangeForm,
  EmptyReport,
  ExportLinks,
  PaginationLinks,
  ReportErrorMessage,
  ReportsHeader,
  ReportTabs,
  parsePage,
} from "../report-ui";

const PAGE_SIZE = 50;

type SearchParams = Promise<{ from?: string; to?: string; page?: string }>;

function toUrlSearchParams(params: Awaited<SearchParams>) {
  const search = new URLSearchParams();
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  return search;
}

export default async function SupplierReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  let me: Awaited<ReturnType<typeof requireManager>>;
  try {
    me = await requireManager();
  } catch (err) {
    if (err instanceof UnauthorizedError)
      redirect("/sign-in?from=/reports/suppliers");
    if (err instanceof ForbiddenError) redirect("/");
    throw err;
  }

  const params = await searchParams;
  const range = parseReportParams(toUrlSearchParams(params));
  let rows: Awaited<ReturnType<typeof perSupplierReport>>;
  let error: string | null = null;
  try {
    rows = await perSupplierReport(range);
  } catch (err) {
    if (!(err instanceof ReportError)) throw err;
    rows = [];
    error = err.message;
  }
  const page = parsePage(params.page, rows.length, PAGE_SIZE);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <AppShell user={me}>
      <ReportsHeader
        title="Per-Supplier Report"
        description="Approved inbound totals by supplier for the selected period."
      />
      <ReportTabs />
      <DateRangeForm range={range} />
      <ExportLinks basePath="/reports/suppliers" range={range} />
      {error ? (
        <ReportErrorMessage message={error} />
      ) : rows.length === 0 ? (
        <EmptyReport />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-surface-border">
            <table className="min-w-full divide-y divide-surface-border text-sm">
              <thead>
                <tr className="bg-zinc-50/60">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Country</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Boxes</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Shipments</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Last received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/60">
                {pageRows.map((row) => (
                  <tr key={row.supplierId} className="transition-colors hover:bg-zinc-50/50">
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {row.supplierName}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {row.country ?? "--"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{row.totalBoxes}</td>
                    <td className="px-4 py-3 text-right font-mono">{row.shipmentCount}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {row.lastReceivedAt?.toLocaleDateString("en-GH") ?? "--"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationLinks
            basePath="/reports/suppliers"
            currentPage={page}
            totalRows={rows.length}
            pageSize={PAGE_SIZE}
            range={range}
          />
        </>
      )}
    </AppShell>
  );
}
