import { notFound, redirect } from "next/navigation";
import { requireManager } from "@/auth-server";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { TopNav } from "@/components/top-nav";
import { getCustomer } from "@/lib/customers";
import { CustomerForm } from "../customer-form";
import {
  deactivateCustomerAction,
  reactivateCustomerAction,
} from "../actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditCustomerPage({ params }: PageProps) {
  let me: Awaited<ReturnType<typeof requireManager>>;
  try {
    me = await requireManager();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in?from=/customers");
    if (err instanceof ForbiddenError) redirect("/");
    throw err;
  }

  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  return (
    <>
      <TopNav user={me} />
      <main className="mx-auto max-w-md px-4 py-6">
        <header className="mb-6 flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">{customer.name}</h1>
            <p className="text-sm text-slate-500">
              Edit details or change active status.
            </p>
          </div>
          {!customer.isActive && (
            <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
              Inactive
            </span>
          )}
        </header>

        <CustomerForm customer={customer} />

        <section className="mt-8 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold">Status</h2>
          {customer.isActive ? (
            <>
              <p className="mt-1 text-sm text-slate-500">
                Deactivating hides this customer from the picker but keeps
                history intact.
              </p>
              <form action={deactivateCustomerAction} className="mt-3">
                <input type="hidden" name="customerId" value={customer.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
                >
                  Deactivate customer
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-500">
                Reactivate to make this customer pickable again.
              </p>
              <form action={reactivateCustomerAction} className="mt-3">
                <input type="hidden" name="customerId" value={customer.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
                >
                  Reactivate customer
                </button>
              </form>
            </>
          )}
        </section>
      </main>
    </>
  );
}
