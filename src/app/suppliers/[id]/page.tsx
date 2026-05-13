import { notFound, redirect } from "next/navigation";
import { requireManager } from "@/auth-server";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { TopNav } from "@/components/top-nav";
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
    <>
      <TopNav user={me} />
      <main className="mx-auto max-w-md px-4 py-6">
        <header className="mb-6 flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">{supplier.name}</h1>
            <p className="text-sm text-slate-500">
              Edit details or change active status.
            </p>
          </div>
          {!supplier.isActive && (
            <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
              Inactive
            </span>
          )}
        </header>

        <SupplierForm supplier={supplier} />

        <section className="mt-8 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold">Status</h2>
          {supplier.isActive ? (
            <>
              <p className="mt-1 text-sm text-slate-500">
                Deactivating hides this supplier from the picker but keeps
                history intact.
              </p>
              <form action={deactivateSupplierAction} className="mt-3">
                <input type="hidden" name="supplierId" value={supplier.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
                >
                  Deactivate supplier
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-500">
                Reactivate to make this supplier pickable again.
              </p>
              <form action={reactivateSupplierAction} className="mt-3">
                <input type="hidden" name="supplierId" value={supplier.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  Reactivate supplier
                </button>
              </form>
            </>
          )}
        </section>
      </main>
    </>
  );
}
