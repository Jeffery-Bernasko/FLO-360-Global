import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth-server";
import { UnauthorizedError } from "@/auth-helpers";
import { TopNav } from "@/components/top-nav";
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
    <>
      <TopNav user={user} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-semibold">Welcome, {user.name}</h1>
          <p className="text-sm text-slate-500">
            {user.role === "manager"
              ? "Your warehouse at a glance."
              : "Your submissions at a glance."}
          </p>
        </header>

        {user.role === "manager" ? (
          <ManagerDashboardSection />
        ) : (
          <WorkerDashboardSection userId={user.id} />
        )}
      </main>
    </>
  );
}

async function ManagerDashboardSection() {
  const { currentStock, pending } = await getManagerDashboard();
  const outOfStock = currentStock <= 0;
  const allCaughtUp = pending.total === 0;

  return (
    <div className="space-y-4">
      <StockCard currentStock={currentStock} outOfStock={outOfStock} />

      {allCaughtUp ? (
        <CaughtUpCard />
      ) : (
        <PendingCard
          total={pending.total}
          inbound={pending.inbound}
          outbound={pending.outbound}
        />
      )}

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <QuickAction
            href="/adjustments/new"
            label="New adjustment"
            description="Damaged, returned, or recount"
          />
          <QuickAction
            href="/reports"
            label="View reports"
            description="Exports for accounting"
          />
        </div>
      </section>
    </div>
  );
}

async function WorkerDashboardSection({ userId }: { userId: string }) {
  const { currentStock, myPending } = await getWorkerDashboard(userId);
  const outOfStock = currentStock <= 0;

  return (
    <div className="space-y-4">
      <StockCard currentStock={currentStock} outOfStock={outOfStock} />

      <Link
        href="/inbound"
        className="block rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          My pending submissions
        </p>
        <p className="mt-1 text-3xl font-semibold text-slate-900">
          {myPending}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Forms awaiting the manager&apos;s decision.
        </p>
      </Link>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <QuickAction
            href="/inbound/new"
            label="New inbound"
            description="Record a shipment"
          />
          <QuickAction
            href="/outbound/new"
            label="New outbound"
            description="Send to a customer"
          />
        </div>
      </section>
    </div>
  );
}

function StockCard({
  currentStock,
  outOfStock,
}: {
  currentStock: number;
  outOfStock: boolean;
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Current stock
      </p>
      <p
        className={`mt-1 text-4xl font-semibold ${
          outOfStock ? "text-rose-600" : "text-slate-900"
        }`}
      >
        {currentStock}{" "}
        <span className="text-base font-normal text-slate-500">boxes</span>
      </p>
      {outOfStock ? (
        <p className="mt-1 text-sm font-medium text-rose-700">Out of stock</p>
      ) : null}
    </section>
  );
}

function CaughtUpCard() {
  return (
    <section className="rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
      <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
        Pending approvals
      </p>
      <p className="mt-1 text-2xl font-semibold text-emerald-900">
        All caught up ✓
      </p>
      <p className="mt-1 text-sm text-emerald-800">
        No forms are waiting for you.
      </p>
    </section>
  );
}

function PendingCard({
  total,
  inbound,
  outbound,
}: {
  total: number;
  inbound: number;
  outbound: number;
}) {
  // Deep-link the big number to whichever inbox has more items (inbound on tie).
  const deepLink =
    outbound > inbound ? "/approvals/outbound" : "/approvals/inbound";
  return (
    <section className="space-y-2">
      <Link
        href={deepLink}
        className="block rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200 hover:bg-amber-100"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
          Pending approvals
        </p>
        <p className="mt-1 text-4xl font-semibold text-amber-900">{total}</p>
        <p className="mt-1 text-sm text-amber-800">Tap to start clearing.</p>
      </Link>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/approvals/inbound"
          className="rounded-xl bg-white p-3 text-center ring-1 ring-slate-200 hover:bg-slate-50"
        >
          <p className="text-xs text-slate-500">Inbound</p>
          <p className="text-2xl font-semibold text-slate-900">{inbound}</p>
        </Link>
        <Link
          href="/approvals/outbound"
          className="rounded-xl bg-white p-3 text-center ring-1 ring-slate-200 hover:bg-slate-50"
        >
          <p className="text-xs text-slate-500">Outbound</p>
          <p className="text-2xl font-semibold text-slate-900">{outbound}</p>
        </Link>
      </div>
    </section>
  );
}

function QuickAction({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
    >
      <p className="font-medium text-slate-900">{label}</p>
      <p className="mt-0.5 text-xs text-slate-500">{description}</p>
    </Link>
  );
}
