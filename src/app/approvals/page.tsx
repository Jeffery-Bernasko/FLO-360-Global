import Link from "next/link";
import { redirect } from "next/navigation";
import { requireManager } from "@/auth-server";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { IconBox, IconChevron, IconInbound, IconOutbound } from "@/components/icons";
import { listPendingInboundForms } from "@/lib/inbound-forms";
import { listPendingOutboundForms } from "@/lib/outbound-forms";
import { getCurrentStock } from "@/lib/stock-ledger";
import { formatGhs } from "@/lib/money";

type InboxItem =
  | { kind: "inbound"; id: string; party: string; boxes: number; date: string; total?: undefined }
  | { kind: "outbound"; id: string; party: string; boxes: number; date: string; total: number };

export default async function InboxPage() {
  let me: Awaited<ReturnType<typeof requireManager>>;
  try {
    me = await requireManager();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in?from=/approvals");
    if (err instanceof ForbiddenError) redirect("/");
    throw err;
  }

  const [inbound, outbound, currentStock] = await Promise.all([
    listPendingInboundForms(),
    listPendingOutboundForms(),
    getCurrentStock(),
  ]);

  const items: InboxItem[] = [
    ...inbound.map((f) => ({
      kind: "inbound" as const,
      id: String(f.id),
      party: f.supplierName,
      boxes: f.boxes,
      date: f.receivedDate,
    })),
    ...outbound.map((f) => ({
      kind: "outbound" as const,
      id: String(f.id),
      party: f.customerName,
      boxes: f.boxes,
      date: f.dispatchDate,
      total: f.totalPesewas ?? f.boxes * f.unitPricePesewas,
    })),
  ];

  const inboundCount = inbound.length;
  const outboundCount = outbound.length;

  return (
    <AppShell user={me}>
      <PageHeader
        title="Inbox"
        description="All pending approval requests in one place."
      />

      {/* Summary metrics */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Current Stock"
          value={currentStock}
          unit="boxes"
          variant={currentStock <= 0 ? "danger" : "default"}
          icon={<IconBox width={20} height={20} />}
        />
        <MetricCard
          label="Inbound Pending"
          value={inboundCount}
          variant={inboundCount > 0 ? "warning" : "success"}
          subtitle={inboundCount === 0 ? "All caught up" : `${inboundCount} awaiting review`}
          icon={<IconInbound width={20} height={20} />}
        />
        <MetricCard
          label="Outbound Pending"
          value={outboundCount}
          variant={outboundCount > 0 ? "warning" : "success"}
          subtitle={outboundCount === 0 ? "All caught up" : `${outboundCount} awaiting review`}
          icon={<IconOutbound width={20} height={20} />}
        />
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="All caught up"
          description="No forms are waiting for your approval."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-surface-border">
          <table className="min-w-full divide-y divide-surface-border text-sm">
            <thead>
              <tr className="bg-zinc-50/60">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Party
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Boxes
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 hidden sm:table-cell">
                  Total
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 hidden sm:table-cell">
                  Date
                </th>
                <th className="px-4 py-3 w-8">
                  <span className="sr-only">Review</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/60">
              {items.map((item) => {
                const href = `/approvals/${item.kind}/${item.id}`;
                const insufficient = item.kind === "outbound" && item.boxes > currentStock;
                return (
                  <tr key={`${item.kind}-${item.id}`} className="transition-colors hover:bg-teal-50/30">
                    <td className="px-4 py-3">
                      <Badge variant={item.kind === "inbound" ? "info" : "pending"}>
                        {item.kind === "inbound" ? (
                          <span className="flex items-center gap-1.5">
                            <IconInbound width={12} height={12} />
                            Inbound
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <IconOutbound width={12} height={12} />
                            Outbound
                          </span>
                        )}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={href} className="font-medium text-zinc-900 hover:text-teal-700">
                          {item.party}
                        </Link>
                        {insufficient && <Badge variant="danger">Low stock</Badge>}
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${insufficient ? "text-rose-600 font-medium" : "text-zinc-700"}`}>
                      {item.boxes}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-700 hidden sm:table-cell">
                      {item.kind === "outbound" ? formatGhs(item.total) : (
                        <span className="text-zinc-400">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 hidden sm:table-cell">
                      {item.date}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={href} className="text-zinc-400 hover:text-teal-600" aria-label="Review">
                        <IconChevron width={16} height={16} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
