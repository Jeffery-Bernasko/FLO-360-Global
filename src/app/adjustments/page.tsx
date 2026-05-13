import { redirect } from "next/navigation";
import { requireManager } from "@/auth-server";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import { IconBox } from "@/components/icons";
import { getAdjustmentsAndCurrentStock } from "@/lib/adjustments";

export default async function AdjustmentsPage() {
  let me: Awaited<ReturnType<typeof requireManager>>;
  try {
    me = await requireManager();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in?from=/adjustments");
    if (err instanceof ForbiddenError) redirect("/");
    throw err;
  }

  const { rows, currentStock } = await getAdjustmentsAndCurrentStock();

  return (
    <AppShell user={me}>
      <PageHeader
        title="Stock Adjustments"
        description="Manual corrections for damages, returns, and recounts."
        actions={<LinkButton href="/adjustments/new">New adjustment</LinkButton>}
      />

      <div className="mb-6">
        <MetricCard
          label="Current Stock"
          value={currentStock}
          unit="boxes"
          variant={currentStock <= 0 ? "danger" : "default"}
          icon={<IconBox width={20} height={20} />}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No adjustments yet"
          description="Use adjustments for damages, returns, or recount corrections."
          actionLabel="New adjustment"
          actionHref="/adjustments/new"
        />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-surface-border">
          <table className="min-w-full divide-y divide-surface-border text-sm">
            <thead>
              <tr className="bg-zinc-50/60">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Reason</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Note</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">By</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Date</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/60">
              {rows.map((r) => (
                <tr key={String(r.id)} className="transition-colors hover:bg-zinc-50/50">
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {r.reason ?? "Adjustment"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 max-w-xs truncate">
                    {r.note || "--"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {r.actorName ?? "unknown"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleDateString("en-GH", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono font-medium ${
                      r.boxesDelta > 0 ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {r.boxesDelta > 0 ? "+" : ""}
                    {r.boxesDelta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
