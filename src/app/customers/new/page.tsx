import { redirect } from "next/navigation";
import { requireManager } from "@/auth-server";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { CustomerForm } from "../customer-form";

export default async function NewCustomerPage() {
  let me: Awaited<ReturnType<typeof requireManager>>;
  try {
    me = await requireManager();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in?from=/customers/new");
    if (err instanceof ForbiddenError) redirect("/");
    throw err;
  }

  return (
    <AppShell user={me}>
      <div className="mx-auto max-w-lg">
        <PageHeader
          title="Add Customer"
          description="Workers will pick this customer when filling outbound forms."
        />
        <CustomerForm />
      </div>
    </AppShell>
  );
}
