import { redirect } from "next/navigation";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { requireManager } from "@/auth-server";
import { AppShell } from "@/components/app-shell";
import { formatGhs } from "@/lib/money";
import { listProducts } from "@/lib/products";
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

type SearchParams = Promise<{ from?: string; to?: string; kind?: string; productId?: string; page?: string }>;

function toUrlSearchParams(params: Awaited<SearchParams>) {
  const search = new URLSearchParams();
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  if (params.kind) search.set("kind", params.kind);
  if (params.productId) search.set("productId", params.productId);
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
  const allProducts = await listProducts(me);
  try {
    rows = await stockMovementReport(filter);
  } catch (err) {
    if (!(err instanceof ReportError)) throw err;
    rows = [];
    error = err.message;
  }
  const productOptions = allProducts.map((p) => ({ id: p.id, name: p.name }));
  const page = parsePage(params.page, rows.length, PAGE_SIZE);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <AppShell user={me}>
      <ReportsHeader
        title="Stock Movement Report"
        description="Every approved movement in chronological order, including adjustments."
      />
      <ReportTabs />
      <DateRangeForm range={filter} kind={filter.kind} showKind productId={filter.productId} products={productOptions} />
      <ExportLinks basePath="/reports/movements" range={filter} kind={filter.kind} productId={filter.productId} />
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
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Kind</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Party</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Boxes</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/60">
                {pageRows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-zinc-50/50">
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                      {row.createdAt.toLocaleDateString("en-GH")}
                    </td>
                    <td className="px-4 py-3 capitalize text-zinc-700">{row.kind}</td>
                    <td className="px-4 py-3 text-zinc-700">{row.productName ?? "--"}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-900">
                        {row.partyName ?? "--"}
                      </p>
                      {row.reason ? (
                        <p className="text-xs text-zinc-400">{row.reason}</p>
                      ) : null}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono font-medium ${
                        row.boxesDelta < 0 ? "text-rose-600" : "text-emerald-600"
                      }`}
                    >
                      {row.boxesDelta > 0 ? "+" : ""}
                      {row.boxesDelta}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-600">
                      {row.totalPesewas == null ? "--" : formatGhs(row.totalPesewas)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-zinc-900">
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
            productId={filter.productId}
          />
        </>
      )}
    </AppShell>
  );
}
