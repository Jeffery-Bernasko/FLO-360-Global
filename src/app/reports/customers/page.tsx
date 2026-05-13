import { redirect } from "next/navigation";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { requireManager } from "@/auth-server";
import { TopNav } from "@/components/top-nav";
import { formatGhs } from "@/lib/money";
import { ReportError, parseReportParams, perCustomerReport } from "@/lib/reports";
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

export default async function CustomerReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  let me: Awaited<ReturnType<typeof requireManager>>;
  try {
    me = await requireManager();
  } catch (err) {
    if (err instanceof UnauthorizedError)
      redirect("/sign-in?from=/reports/customers");
    if (err instanceof ForbiddenError) redirect("/");
    throw err;
  }

  const params = await searchParams;
  const range = parseReportParams(toUrlSearchParams(params));
  let rows: Awaited<ReturnType<typeof perCustomerReport>>;
  let error: string | null = null;
  try {
    rows = await perCustomerReport(range);
  } catch (err) {
    if (!(err instanceof ReportError)) throw err;
    rows = [];
    error = err.message;
  }
  const page = parsePage(params.page, rows.length, PAGE_SIZE);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <TopNav user={me} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <ReportsHeader
          title="Per-customer report"
          description="Approved outbound totals by customer for the selected period."
        />
        <ReportTabs />
        <DateRangeForm range={range} />
        <ExportLinks basePath="/reports/customers" range={range} />
        {error ? (
          <ReportErrorMessage message={error} />
        ) : rows.length === 0 ? (
          <EmptyReport />
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3 text-right">Boxes</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Dispatches</th>
                    <th className="px-4 py-3">Last dispatch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageRows.map((row) => (
                    <tr key={row.customerId}>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {row.customerName}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {row.customerLocation ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-right">{row.totalBoxes}</td>
                      <td className="px-4 py-3 text-right">
                        {formatGhs(row.totalPesewas)}
                      </td>
                      <td className="px-4 py-3 text-right">{row.dispatchCount}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {row.lastDispatchAt?.toLocaleDateString("en-GH") ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationLinks
              basePath="/reports/customers"
              currentPage={page}
              totalRows={rows.length}
              pageSize={PAGE_SIZE}
              range={range}
            />
          </>
        )}
      </main>
    </>
  );
}
