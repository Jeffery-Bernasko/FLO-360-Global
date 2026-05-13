import { redirect } from "next/navigation";
import { requireUser } from "@/auth-server";
import { UnauthorizedError } from "@/auth-helpers";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
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
    <AppShell user={me}>
      <div className="mx-auto max-w-lg">
        <PageHeader
          title="New Outbound Dispatch"
          description="Submit for the manager's approval. Stock is deducted once approved and an invoice PDF is generated."
        />
        <OutboundFormFields mode={{ kind: "create", currentStock }} />
      </div>
    </AppShell>
  );
}
