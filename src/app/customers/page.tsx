import Link from "next/link";
import { redirect } from "next/navigation";
import { requireManager } from "@/auth-server";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { TopNav } from "@/components/top-nav";
import { listCustomers } from "@/lib/customers";
import type { Customer } from "@/db/schema";

export default async function CustomersPage() {
  let me: Awaited<ReturnType<typeof requireManager>>;
  try {
    me = await requireManager();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in?from=/customers");
    if (err instanceof ForbiddenError) redirect("/");
    throw err;
  }

  const all = await listCustomers(me);
  const active = all.filter((c) => c.isActive);
  const inactive = all.filter((c) => !c.isActive);

  return (
    <>
      <TopNav user={me} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Customers</h1>
            <p className="text-sm text-slate-500">
              Buyers who receive outbound shipments.
            </p>
          </div>
          <Link
            href="/customers/new"
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-700"
          >
            Add customer
          </Link>
        </div>

        <Section title="Active" empty="No active customers yet.">
          {active.map((c) => (
            <CustomerRow key={c.id} customer={c} />
          ))}
        </Section>

        {inactive.length > 0 && (
          <div className="mt-8">
            <Section title="Inactive" empty="">
              {inactive.map((c) => (
                <CustomerRow key={c.id} customer={c} />
              ))}
            </Section>
          </div>
        )}
      </main>
    </>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  const isEmpty = items.filter(Boolean).length === 0;

  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        {isEmpty ? (
          <p className="p-4 text-sm text-slate-500">{empty}</p>
        ) : (
          <ul className="divide-y divide-slate-200">{children}</ul>
        )}
      </div>
    </section>
  );
}

function CustomerRow({ customer }: { customer: Customer }) {
  return (
    <li>
      <Link
        href={`/customers/${customer.id}`}
        className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{customer.name}</p>
            {!customer.isActive && (
              <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                Inactive
              </span>
            )}
          </div>
          <p className="truncate text-sm text-slate-500">
            {[customer.location, customer.phone].filter(Boolean).join(" · ") ||
              "—"}
          </p>
        </div>
        <span aria-hidden className="text-slate-400">›</span>
      </Link>
    </li>
  );
}
