import { redirect } from "next/navigation";
import { requireManager } from "@/auth-server";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { SupplierForm } from "../supplier-form";

export default async function NewSupplierPage() {
  let me: Awaited<ReturnType<typeof requireManager>>;
  try {
    me = await requireManager();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in?from=/suppliers/new");
    if (err instanceof ForbiddenError) redirect("/");
    throw err;
  }

  return (
    <AppShell user={me}>
      <div className="mx-auto max-w-lg">
        <PageHeader
          title="Add Supplier"
          description="Workers will pick this supplier when filling inbound forms."
        />
        <SupplierForm />
      </div>
    </AppShell>
  );
}
