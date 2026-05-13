import { notFound, redirect } from "next/navigation";
import { requireManager } from "@/auth-server";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getSupplier } from "@/lib/suppliers";
import { SupplierForm } from "../supplier-form";
import {
  deactivateSupplierAction,
  reactivateSupplierAction,
} from "../actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditSupplierPage({ params }: PageProps) {
  let me: Awaited<ReturnType<typeof requireManager>>;
  try {
    me = await requireManager();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in?from=/suppliers");
    if (err instanceof ForbiddenError) redirect("/");
    throw err;
  }

  const { id } = await params;
  const supplier = await getSupplier(id);
  if (!supplier) notFound();

  return (
    <AppShell user={me}>
      <div className="mx-auto max-w-lg">
        <PageHeader
          title={supplier.name}
          description="Edit details or change active status."
          actions={!supplier.isActive ? <Badge variant="danger">Inactive</Badge> : undefined}
        />

        <SupplierForm supplier={supplier} />

        <Card className="mt-6">
          <h2 className="font-display text-base font-semibold text-zinc-900">Status</h2>
          {supplier.isActive ? (
            <>
              <p className="mt-2 text-sm text-zinc-500">
                Deactivating hides this supplier from the picker but keeps
                history intact.
              </p>
              <form action={deactivateSupplierAction} className="mt-3">
                <input type="hidden" name="supplierId" value={supplier.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100 focus-ring"
                >
                  Deactivate supplier
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-zinc-500">
                Reactivate to make this supplier pickable again.
              </p>
              <form action={reactivateSupplierAction} className="mt-3">
                <input type="hidden" name="supplierId" value={supplier.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 focus-ring"
                >
                  Reactivate supplier
                </button>
              </form>
            </>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
