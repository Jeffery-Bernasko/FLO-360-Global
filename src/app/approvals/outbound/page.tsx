import Link from "next/link";
import { redirect } from "next/navigation";
import { requireManager } from "@/auth-server";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { IconChevron } from "@/components/icons";
import { listPendingOutboundForms } from "@/lib/outbound-forms";
import { formatGhs } from "@/lib/money";

export default async function PendingOutboundPage() {
  let me: Awaited<ReturnType<typeof requireManager>>;
  try {
    me = await requireManager();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in?from=/approvals/outbound");
    if (err instanceof ForbiddenError) redirect("/");
    throw err;
  }

  const pending = await listPendingOutboundForms();

  return (
    <AppShell user={me}>
      <PageHeader
        title="Pending Outbound"
        description="Approving deducts boxes from stock and generates an invoice."
      />

      {pending.length === 0 ? (
        <EmptyState
          title="All caught up"
          description="No outbound forms are waiting for your approval."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-surface-border">
          <table className="min-w-full divide-y divide-surface-border text-sm">
            <thead>
              <tr className="bg-zinc-50/60">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Customer</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Boxes</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Total</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Dispatch</th>
                <th className="px-4 py-3 w-8"><span className="sr-only">Review</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/60">
              {pending.map((f) => (
                  <tr key={String(f.id)} className="transition-colors hover:bg-emerald-50/30">
                    <td className="px-4 py-3">
                      <Link href={`/approvals/outbound/${f.id}`} className="font-medium text-zinc-900 hover:text-green-800">
                        {f.customerName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-700">
                      {f.boxes}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-700">{formatGhs(f.totalPesewas)}</td>
                    <td className="px-4 py-3 text-zinc-500">{f.dispatchDate}</td>
                    <td className="px-4 py-3">
                      <Link href={`/approvals/outbound/${f.id}`} className="text-zinc-400 hover:text-green-700" aria-label="Review">
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
