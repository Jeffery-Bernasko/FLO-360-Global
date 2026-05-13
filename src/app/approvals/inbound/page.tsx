import Link from "next/link";
import { redirect } from "next/navigation";
import { requireManager } from "@/auth-server";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import { IconBox, IconChevron } from "@/components/icons";
import { listPendingInboundForms } from "@/lib/inbound-forms";
import { getCurrentStock } from "@/lib/stock-ledger";

export default async function PendingInboundPage() {
  let me: Awaited<ReturnType<typeof requireManager>>;
  try {
    me = await requireManager();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in?from=/approvals/inbound");
    if (err instanceof ForbiddenError) redirect("/");
    throw err;
  }

  const [pending, currentStock] = await Promise.all([
    listPendingInboundForms(),
    getCurrentStock(),
  ]);

  return (
    <AppShell user={me}>
      <PageHeader
        title="Pending Inbound"
        description="Approving adds boxes to stock."
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

      {pending.length === 0 ? (
        <EmptyState
          title="All caught up"
          description="No inbound forms are waiting for your approval."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-surface-border">
          <table className="min-w-full divide-y divide-surface-border text-sm">
            <thead>
              <tr className="bg-zinc-50/60">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Supplier</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Boxes</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Received</th>
                <th className="px-4 py-3 w-8"><span className="sr-only">Review</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/60">
              {pending.map((f) => (
                <tr key={String(f.id)} className="transition-colors hover:bg-teal-50/30">
                  <td className="px-4 py-3">
                    <Link href={`/approvals/inbound/${f.id}`} className="font-medium text-zinc-900 hover:text-teal-700">
                      {f.supplierName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-700">{f.boxes}</td>
                  <td className="px-4 py-3 text-zinc-500">{f.receivedDate}</td>
                  <td className="px-4 py-3">
                    <Link href={`/approvals/inbound/${f.id}`} className="text-zinc-400 hover:text-teal-600" aria-label="Review">
                      <IconChevron width={16} height={16} />
                    </Link>
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
