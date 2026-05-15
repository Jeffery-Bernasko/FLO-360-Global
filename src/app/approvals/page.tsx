import Link from "next/link";
import { redirect } from "next/navigation";
import { requireManager } from "@/auth-server";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { Card } from "@/components/ui/card";
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
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => {
            const href = `/approvals/${item.kind}/${item.id}`;
            const isInbound = item.kind === "inbound";
            const insufficient = item.kind === "outbound" && item.boxes > currentStock;
            const Icon = isInbound ? IconInbound : IconOutbound;

            return (
              <Card
                key={`${item.kind}-${item.id}`}
                className="transition-colors hover:bg-emerald-50/30"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant={isInbound ? "info" : "pending"}>
                        <span className="flex items-center gap-1.5">
                          <Icon width={12} height={12} />
                          {isInbound ? "Incoming Approval" : "Outgoing Approval"}
                        </span>
                      </Badge>
                      {insufficient ? <Badge variant="danger">Low stock</Badge> : null}
                    </div>
                    <Link
                      href={href}
                      className="block truncate text-base font-semibold text-zinc-900 hover:text-green-800"
                    >
                      {item.party}
                    </Link>
                    <p className="mt-1 text-xs text-zinc-500">
                      {isInbound ? "Inbound" : "Outbound"} #{item.id}
                    </p>
                  </div>
                  <Link
                    href={href}
                    className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-white hover:text-green-700"
                    aria-label={`Review ${isInbound ? "incoming" : "outgoing"} approval #${item.id}`}
                  >
                    <IconChevron width={16} height={16} />
                  </Link>
                </div>

                <dl className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Boxes
                    </dt>
                    <dd className={`mt-1 font-mono ${insufficient ? "font-medium text-rose-600" : "text-zinc-800"}`}>
                      {item.boxes}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Total
                    </dt>
                    <dd className="mt-1 font-mono text-zinc-800">
                      {isInbound ? <span className="text-zinc-400">-</span> : formatGhs(item.total)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                      Date
                    </dt>
                    <dd className="mt-1 text-zinc-600">{item.date}</dd>
                  </div>
                </dl>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
