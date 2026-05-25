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
import { listProducts } from "@/lib/products";
import type { Product } from "@/db/schema";

export default async function ProductsPage() {
  let me: Awaited<ReturnType<typeof requireManager>>;
  try {
    me = await requireManager();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in?from=/products");
    if (err instanceof ForbiddenError) redirect("/");
    throw err;
  }

  const all = await listProducts(me);
  const active = all.filter((p) => p.isActive);
  const inactive = all.filter((p) => !p.isActive);

  return (
    <AppShell user={me}>
      <PageHeader
        title="Products"
        description="Manage your product catalog."
        actions={<LinkButton href="/products/new">Add product</LinkButton>}
      />

      {active.length === 0 && inactive.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="Add your first product to get started."
          actionLabel="Add product"
          actionHref="/products/new"
        />
      ) : (
        <div className="space-y-6">
          <ProductTable title="Active" products={active} emptyMessage="No active products." />
          {inactive.length > 0 && (
            <ProductTable title="Inactive" products={inactive} emptyMessage="" />
          )}
        </div>
      )}
    </AppShell>
  );
}

function ProductTable({
  title,
  products,
  emptyMessage,
}: {
  title: string;
  products: Product[];
  emptyMessage: string;
}) {
  if (products.length === 0 && emptyMessage) {
    return (
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
        <div className="rounded-xl bg-white px-6 py-8 text-center text-sm text-zinc-500 ring-1 ring-surface-border">
          {emptyMessage}
        </div>
      </section>
    );
  }
  if (products.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
      <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-surface-border">
        <table className="min-w-full divide-y divide-surface-border text-sm">
          <thead>
            <tr className="bg-zinc-50/60">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Description</th>
              <th className="px-4 py-3 w-8"><span className="sr-only">Edit</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border/60">
            {products.map((p) => (
              <tr key={p.id} className="transition-colors hover:bg-emerald-50/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link href={`/products/${p.id}`} className="font-medium text-zinc-900 hover:text-green-800">
                      {p.name}
                    </Link>
                    {!p.isActive && <Badge variant="danger">Inactive</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-500">{p.description || "--"}</td>
                <td className="px-4 py-3">
                  <Link href={`/products/${p.id}`} className="text-zinc-400 hover:text-green-700" aria-label={`Edit ${p.name}`}>
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
