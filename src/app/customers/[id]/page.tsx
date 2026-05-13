import { notFound, redirect } from "next/navigation";
import { requireManager } from "@/auth-server";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
    <AppShell user={me}>
      <div className="mx-auto max-w-lg">
        <PageHeader
          title={customer.name}
          description="Edit details or change active status."
          actions={!customer.isActive ? <Badge variant="danger">Inactive</Badge> : undefined}
        />

        <CustomerForm customer={customer} />

        <Card className="mt-6">
          <h2 className="font-display text-base font-semibold text-zinc-900">Status</h2>
          {customer.isActive ? (
            <>
              <p className="mt-2 text-sm text-zinc-500">
                Deactivating hides this customer from the picker but keeps
                history intact.
              </p>
              <form action={deactivateCustomerAction} className="mt-3">
                <input type="hidden" name="customerId" value={customer.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100 focus-ring"
                >
                  Deactivate customer
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-zinc-500">
                Reactivate to make this customer pickable again.
              </p>
              <form action={reactivateCustomerAction} className="mt-3">
                <input type="hidden" name="customerId" value={customer.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 focus-ring"
                >
                  Reactivate customer
                </button>
              </form>
            </>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
