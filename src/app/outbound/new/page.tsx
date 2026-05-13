import { redirect } from "next/navigation";
import { requireUser } from "@/auth-server";
import { UnauthorizedError } from "@/auth-helpers";
import { TopNav } from "@/components/top-nav";
import { getCurrentStock } from "@/lib/stock-ledger";
import { OutboundFormFields } from "../outbound-form-fields";

export default async function NewOutboundFormPage() {
  let me: Awaited<ReturnType<typeof requireUser>>;
  try {
    me = await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in?from=/outbound/new");
    throw err;
  }

  const currentStock = await getCurrentStock();

  return (
    <>
      <TopNav user={me} />
      <main className="mx-auto max-w-md px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-semibold">New outbound dispatch</h1>
          <p className="text-sm text-slate-500">
            Submit for the manager&apos;s approval. Stock is deducted once
            approved and an invoice PDF is generated.
          </p>
        </header>

        <OutboundFormFields mode={{ kind: "create", currentStock }} />
      </main>
    </>
  );
}
