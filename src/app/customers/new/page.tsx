import { redirect } from "next/navigation";
import { requireManager } from "@/auth-server";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { TopNav } from "@/components/top-nav";
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
    <>
      <TopNav user={me} />
      <main className="mx-auto max-w-md px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-semibold">Add customer</h1>
          <p className="text-sm text-slate-500">
            Workers will pick this customer when filling outbound forms.
          </p>
        </header>

        <CustomerForm />
      </main>
    </>
  );
}
