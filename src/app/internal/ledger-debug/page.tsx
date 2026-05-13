import { requireManager } from "@/auth-server";
import { TopNav } from "@/components/top-nav";
import { getCurrentStock, getMovements } from "@/lib/stock-ledger";
import { recordDebugAdjustment } from "./actions";

const KIND_LABEL: Record<string, string> = {
  inbound: "Inbound",
  outbound: "Outbound",
  adjustment: "Adjustment",
};

export default async function LedgerDebugPage() {
  const me = await requireManager();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [currentStock, recent] = await Promise.all([
    getCurrentStock(),
    getMovements({ from: thirtyDaysAgo, to: now, limit: 50 }),
  ]);

  return (
    <>
      <TopNav user={me} />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-semibold">Stock ledger (debug)</h1>
          <p className="text-sm text-slate-500">
            Internal page for verifying the F3 ledger module end-to-end. Will
            be removed once F7 (adjustments) ships.
          </p>
        </header>

        <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Current stock
          </p>
          <p
            className={`mt-1 text-3xl font-semibold ${
              currentStock <= 0 ? "text-rose-600" : "text-slate-900"
            }`}
          >
            {currentStock} <span className="text-base font-normal text-slate-500">boxes</span>
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <DebugButton delta={1} label="+1 box" />
            <DebugButton delta={5} label="+5 boxes" />
            <DebugButton delta={-1} label="-1 box" />
            <DebugButton delta={-5} label="-5 boxes" />
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Last 30 days · {recent.length} movements
          </h2>
          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
            {recent.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">
                No movements yet. Use the buttons above to record one.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {recent.map((m) => (
                  <li
                    key={String(m.id)}
                    className="flex items-center justify-between p-4 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {KIND_LABEL[m.kind] ?? m.kind}{" "}
                        {m.reason ? (
                          <span className="text-slate-500">— {m.reason}</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(m.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <p
                      className={`font-mono text-base ${
                        m.boxesDelta > 0 ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {m.boxesDelta > 0 ? "+" : ""}
                      {m.boxesDelta}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </>
  );
}

function DebugButton({ delta, label }: { delta: number; label: string }) {
  return (
    <form action={recordDebugAdjustment}>
      <input type="hidden" name="delta" value={delta} />
      <button
        type="submit"
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        {label}
      </button>
    </form>
  );
}
