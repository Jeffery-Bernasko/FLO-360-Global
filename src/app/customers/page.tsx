import Link from "next/link";
import { redirect } from "next/navigation";
import { requireManager } from "@/auth-server";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { IconChevron } from "@/components/icons";
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
    <AppShell user={me}>
      <PageHeader
        title="Customers"
        description="Buyers who receive outbound shipments."
        actions={<LinkButton href="/customers/new">Add customer</LinkButton>}
      />

      {active.length === 0 && inactive.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Add your first customer to get started."
          actionLabel="Add customer"
          actionHref="/customers/new"
        />
      ) : (
        <div className="space-y-6">
          <CustomerTable title="Active" customers={active} emptyMessage="No active customers." />
          {inactive.length > 0 && (
            <CustomerTable title="Inactive" customers={inactive} emptyMessage="" />
          )}
        </div>
      )}
    </AppShell>
  );
}

function CustomerTable({
  title,
  customers,
  emptyMessage,
}: {
  title: string;
  customers: Customer[];
  emptyMessage: string;
}) {
  if (customers.length === 0 && emptyMessage) {
    return (
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
        <div className="rounded-xl bg-white px-6 py-8 text-center text-sm text-zinc-500 ring-1 ring-surface-border">
          {emptyMessage}
        </div>
      </section>
    );
  }
  if (customers.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
      <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-surface-border">
        <table className="min-w-full divide-y divide-surface-border text-sm">
          <thead>
            <tr className="bg-zinc-50/60">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Location</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Phone</th>
              <th className="px-4 py-3 w-8"><span className="sr-only">Edit</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border/60">
            {customers.map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-teal-50/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link href={`/customers/${c.id}`} className="font-medium text-zinc-900 hover:text-teal-700">
                      {c.name}
                    </Link>
                    {!c.isActive && <Badge variant="danger">Inactive</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-500">{c.location || "--"}</td>
                <td className="px-4 py-3 text-zinc-500">{c.phone || "--"}</td>
                <td className="px-4 py-3">
                  <Link href={`/customers/${c.id}`} className="text-zinc-400 hover:text-teal-600" aria-label={`Edit ${c.name}`}>
                    <IconChevron width={16} height={16} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
