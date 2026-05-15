import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth-server";
import { UnauthorizedError } from "@/auth-helpers";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconChevron } from "@/components/icons";
import { listMyOutboundForms } from "@/lib/outbound-forms";
import { formatGhs } from "@/lib/money";

export default async function OutboundListPage() {
  let me: Awaited<ReturnType<typeof requireUser>>;
  try {
    me = await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in?from=/outbound");
    throw err;
  }

  const forms = await listMyOutboundForms(me.id);

  return (
    <AppShell user={me}>
      <PageHeader
        title="Outbound"
        description="Goods going out to customers -- your submissions."
        actions={<LinkButton href="/outbound/new">New outbound</LinkButton>}
      />

      {forms.length === 0 ? (
        <EmptyState
          title="No outbound forms yet"
          description="Submit your first outbound form to dispatch goods."
          actionLabel="New outbound"
          actionHref="/outbound/new"
        />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-surface-border">
          <table className="min-w-full divide-y divide-surface-border text-sm">
            <thead>
              <tr className="bg-zinc-50/60">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Boxes</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Total</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Dispatch</th>
                <th className="px-4 py-3 w-8"><span className="sr-only">View</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/60">
              {forms.map((f) => (
                <tr key={String(f.id)} className="transition-colors hover:bg-emerald-50/30">
                  <td className="px-4 py-3">
                    <Link href={`/outbound/${f.id}`} className="font-medium text-zinc-900 hover:text-green-800">
                      {f.customerName}
                    </Link>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-700">{f.boxes}</td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-700">
                    {formatGhs(f.totalPesewas ?? f.boxes * f.unitPricePesewas)}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{f.dispatchDate}</td>
                  <td className="px-4 py-3">
                    <Link href={`/outbound/${f.id}`} className="text-zinc-400 hover:text-green-700" aria-label={`View outbound #${f.id}`}>
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
