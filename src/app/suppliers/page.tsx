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
import { listSuppliers } from "@/lib/suppliers";
import type { Supplier } from "@/db/schema";

export default async function SuppliersPage() {
  let me: Awaited<ReturnType<typeof requireManager>>;
  try {
    me = await requireManager();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in?from=/suppliers");
    if (err instanceof ForbiddenError) redirect("/");
    throw err;
  }

  const all = await listSuppliers(me);
  const active = all.filter((s) => s.isActive);
  const inactive = all.filter((s) => !s.isActive);

  return (
    <AppShell user={me}>
      <PageHeader
        title="Suppliers"
        description="Overseas counterparts who deliver inbound shipments."
        actions={<LinkButton href="/suppliers/new">Add supplier</LinkButton>}
      />

      {active.length === 0 && inactive.length === 0 ? (
        <EmptyState
          title="No suppliers yet"
          description="Add your first supplier to get started."
          actionLabel="Add supplier"
          actionHref="/suppliers/new"
        />
      ) : (
        <div className="space-y-6">
          <SupplierTable title="Active" suppliers={active} emptyMessage="No active suppliers." />
          {inactive.length > 0 && (
            <SupplierTable title="Inactive" suppliers={inactive} emptyMessage="" />
          )}
        </div>
      )}
    </AppShell>
  );
}

function SupplierTable({
  title,
  suppliers,
  emptyMessage,
}: {
  title: string;
  suppliers: Supplier[];
  emptyMessage: string;
}) {
  if (suppliers.length === 0 && emptyMessage) {
    return (
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
        <div className="rounded-xl bg-white px-6 py-8 text-center text-sm text-zinc-500 ring-1 ring-surface-border">
          {emptyMessage}
        </div>
      </section>
    );
  }
  if (suppliers.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
      <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-surface-border">
        <table className="min-w-full divide-y divide-surface-border text-sm">
          <thead>
            <tr className="bg-zinc-50/60">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Country</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Contact</th>
              <th className="px-4 py-3 w-8"><span className="sr-only">Edit</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border/60">
            {suppliers.map((s) => (
              <tr key={s.id} className="transition-colors hover:bg-emerald-50/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link href={`/suppliers/${s.id}`} className="font-medium text-zinc-900 hover:text-green-800">
                      {s.name}
                    </Link>
                    {!s.isActive && <Badge variant="danger">Inactive</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-500">{s.country || "--"}</td>
                <td className="px-4 py-3 text-zinc-500">{s.contact || "--"}</td>
                <td className="px-4 py-3">
                  <Link href={`/suppliers/${s.id}`} className="text-zinc-400 hover:text-green-700" aria-label={`Edit ${s.name}`}>
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
