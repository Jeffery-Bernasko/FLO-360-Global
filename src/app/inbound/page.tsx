import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth-server";
import { UnauthorizedError } from "@/auth-helpers";
import { TopNav } from "@/components/top-nav";
import { StatusBadge } from "@/components/status-badge";
import { listMyInboundForms } from "@/lib/inbound-forms";

export default async function InboundListPage() {
  let me: Awaited<ReturnType<typeof requireUser>>;
  try {
    me = await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in?from=/inbound");
    throw err;
  }

  const forms = await listMyInboundForms(me.id);

  return (
    <>
      <TopNav user={me} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Inbound</h1>
            <p className="text-sm text-slate-500">
              Goods coming in from suppliers — your submissions.
            </p>
          </div>
          <Link
            href="/inbound/new"
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-700"
          >
            New inbound
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          {forms.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">
              You haven&apos;t submitted any inbound forms yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {forms.map((f) => (
                <li key={String(f.id)}>
                  <Link
                    href={`/inbound/${f.id}`}
                    className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{f.supplierName}</p>
                        <StatusBadge status={f.status} />
                      </div>
                      <p className="text-sm text-slate-500">
                        {f.boxes} boxes · received {f.receivedDate}
                      </p>
                    </div>
                    <span aria-hidden className="text-slate-400">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
