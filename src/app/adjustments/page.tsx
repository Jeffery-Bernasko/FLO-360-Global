import Link from "next/link";
import { redirect } from "next/navigation";
import { requireManager } from "@/auth-server";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { TopNav } from "@/components/top-nav";
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
    <>
      <TopNav user={me} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Stock adjustments</h1>
            <p className="text-sm text-slate-500">
              Current stock: <strong>{currentStock}</strong> boxes
            </p>
          </div>
          <Link
            href="/adjustments/new"
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-700"
          >
            New adjustment
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          {rows.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">
              No adjustments yet. Use this for damages, returns, or recount
              corrections.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {rows.map((r) => (
                <li
                  key={String(r.id)}
                  className="flex items-start justify-between gap-4 p-4 text-sm"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {r.reason ?? "Adjustment"}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(r.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {r.note ? (
                      <p className="mt-1 text-slate-700">{r.note}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-500">
                      by {r.actorName ?? "unknown"}
                    </p>
                  </div>
                  <p
                    className={`font-mono text-base ${
                      r.boxesDelta > 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {r.boxesDelta > 0 ? "+" : ""}
                    {r.boxesDelta}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
