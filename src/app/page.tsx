import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth-server";
import { UnauthorizedError } from "@/auth-helpers";
import { AppShell } from "@/components/app-shell";
import { MetricCard } from "@/components/ui/metric-card";
import { PageHeader } from "@/components/ui/page-header";
import { IconBox, IconInbound, IconOutbound, IconAdjustment, IconReports } from "@/components/icons";
import {
  getManagerDashboard,
  getWorkerDashboard,
} from "@/lib/dashboard";

export default async function HomePage() {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in?from=/");
    throw err;
  }

  return (
    <AppShell user={user}>
      <PageHeader
        title={`Welcome back, ${user.name}`}
        description={
          user.role === "manager"
            ? "Your warehouse at a glance."
            : "Your submissions at a glance."
        }
      />

      {user.role === "manager" ? (
        <ManagerDashboard />
      ) : (
        <WorkerDashboard userId={user.id} />
      )}
    </AppShell>
  );
}

async function ManagerDashboard() {
  const { currentStock, pending } = await getManagerDashboard();
  const outOfStock = currentStock <= 0;

  return (
    <div className="space-y-6">
      {/* Metrics row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Current Stock"
          value={currentStock}
          unit="boxes"
          variant={outOfStock ? "danger" : "default"}
          subtitle={outOfStock ? "Out of stock" : undefined}
          icon={<IconBox width={20} height={20} />}
        />

        {pending.total === 0 ? (
          <MetricCard
            label="Pending Approvals"
            value="0"
            variant="success"
            subtitle="All caught up"
            href="/approvals/inbound"
          />
        ) : (
          <MetricCard
            label="Pending Approvals"
            value={pending.total}
            variant="warning"
            subtitle={`${pending.inbound} inbound, ${pending.outbound} outbound`}
            href={pending.outbound > pending.inbound ? "/approvals/outbound" : "/approvals/inbound"}
          />
        )}

        {pending.total > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Inbound"
              value={pending.inbound}
              href="/approvals/inbound"
              variant={pending.inbound > 0 ? "warning" : "default"}
            />
            <MetricCard
              label="Outbound"
              value={pending.outbound}
              href="/approvals/outbound"
              variant={pending.outbound > 0 ? "warning" : "default"}
            />
          </div>
        ) : null}
      </div>

      {/* Quick actions */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Quick actions
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            href="/adjustments/new"
            icon={<IconAdjustment width={20} height={20} />}
            label="New adjustment"
            description="Damaged, returned, or recount"
          />
          <QuickAction
            href="/reports"
            icon={<IconReports width={20} height={20} />}
            label="View reports"
            description="Exports for accounting"
          />
          <QuickAction
            href="/inbound/new"
            icon={<IconInbound width={20} height={20} />}
            label="New inbound"
            description="Record a shipment"
          />
          <QuickAction
            href="/outbound/new"
            icon={<IconOutbound width={20} height={20} />}
            label="New outbound"
            description="Send to a customer"
          />
        </div>
      </section>
    </div>
  );
}

async function WorkerDashboard({ userId }: { userId: string }) {
  const { currentStock, myPending } = await getWorkerDashboard(userId);
  const outOfStock = currentStock <= 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Current Stock"
          value={currentStock}
          unit="boxes"
          variant={outOfStock ? "danger" : "default"}
          subtitle={outOfStock ? "Out of stock" : undefined}
          icon={<IconBox width={20} height={20} />}
        />
        <MetricCard
          label="My Pending"
          value={myPending}
          subtitle="Forms awaiting decision"
          href="/inbound"
          variant={myPending > 0 ? "warning" : "success"}
        />
      </div>

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Quick actions
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <QuickAction
            href="/inbound/new"
            icon={<IconInbound width={20} height={20} />}
            label="New inbound"
            description="Record a shipment"
          />
          <QuickAction
            href="/outbound/new"
            icon={<IconOutbound width={20} height={20} />}
            label="New outbound"
            description="Send to a customer"
          />
        </div>
      </section>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-surface-border transition-all hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="rounded-lg bg-zinc-100 p-2 text-zinc-500 transition-colors group-hover:bg-teal-50 group-hover:text-teal-700">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zinc-900">{label}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
      </div>
    </Link>
  );
}
