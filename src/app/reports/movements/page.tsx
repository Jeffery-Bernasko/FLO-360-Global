import { redirect } from "next/navigation";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { requireManager } from "@/auth-server";
import { TopNav } from "@/components/top-nav";
import { formatGhs } from "@/lib/money";
import { ReportError, parseReportParams, stockMovementReport } from "@/lib/reports";
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

type SearchParams = Promise<{ from?: string; to?: string; kind?: string; page?: string }>;

function toUrlSearchParams(params: Awaited<SearchParams>) {
  const search = new URLSearchParams();
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  if (params.kind) search.set("kind", params.kind);
  return search;
}

export default async function StockMovementReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  let me: Awaited<ReturnType<typeof requireManager>>;
  try {
    me = await requireManager();
  } catch (err) {
    if (err instanceof UnauthorizedError)
      redirect("/sign-in?from=/reports/movements");
    if (err instanceof ForbiddenError) redirect("/");
    throw err;
  }

  const params = await searchParams;
  const filter = parseReportParams(toUrlSearchParams(params));
  let rows: Awaited<ReturnType<typeof stockMovementReport>>;
  let error: string | null = null;
  try {
    rows = await stockMovementReport(filter);
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
          title="Stock movement report"
          description="Every approved movement in chronological order, including adjustments."
        />
        <ReportTabs />
        <DateRangeForm range={filter} kind={filter.kind} showKind />
        <ExportLinks basePath="/reports/movements" range={filter} kind={filter.kind} />
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
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Kind</th>
                    <th className="px-4 py-3">Party</th>
                    <th className="px-4 py-3 text-right">Boxes</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageRows.map((row) => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {row.createdAt.toLocaleDateString("en-GH")}
                      </td>
                      <td className="px-4 py-3 capitalize">{row.kind}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {row.partyName ?? "-"}
                        </p>
                        {row.reason ? (
                          <p className="text-xs text-slate-500">{row.reason}</p>
                        ) : null}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono ${
                          row.boxesDelta < 0 ? "text-rose-700" : "text-emerald-700"
                        }`}
                      >
                        {row.boxesDelta > 0 ? "+" : ""}
                        {row.boxesDelta}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.totalPesewas == null ? "-" : formatGhs(row.totalPesewas)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {row.runningBalance}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationLinks
              basePath="/reports/movements"
              currentPage={page}
              totalRows={rows.length}
              pageSize={PAGE_SIZE}
              range={filter}
              kind={filter.kind}
            />
          </>
        )}
      </main>
    </>
  );
}
