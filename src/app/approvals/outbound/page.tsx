import Link from "next/link";
import { redirect } from "next/navigation";
import { requireManager } from "@/auth-server";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { TopNav } from "@/components/top-nav";
import { listPendingOutboundForms } from "@/lib/outbound-forms";
import { getCurrentStock } from "@/lib/stock-ledger";
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

  const [pending, currentStock] = await Promise.all([
    listPendingOutboundForms(),
    getCurrentStock(),
  ]);

  return (
    <>
      <TopNav user={me} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <header className="mb-6">
          <div className="flex items-baseline justify-between">
            <h1 className="text-xl font-semibold">Pending outbound</h1>
            <p className="text-sm text-slate-500">
              Current stock: <strong>{currentStock}</strong> boxes
            </p>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Approving deducts boxes from stock and generates an invoice.
          </p>
        </header>

        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          {pending.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">All caught up ✓</p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {pending.map((f) => {
                const total = f.totalPesewas ?? f.boxes * f.unitPricePesewas;
                const insufficient = f.boxes > currentStock;
                return (
                  <li key={String(f.id)}>
                    <Link
                      href={`/approvals/outbound/${f.id}`}
                      className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{f.customerName}</p>
                        <p className="text-sm text-slate-500">
                          {f.boxes} boxes · {formatGhs(total)} · dispatch{" "}
                          {f.dispatchDate}
                        </p>
                        {insufficient ? (
                          <p className="mt-1 text-xs font-medium text-rose-700">
                            Insufficient stock ({currentStock} available)
                          </p>
                        ) : null}
                      </div>
                      <span aria-hidden className="text-slate-400">›</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
