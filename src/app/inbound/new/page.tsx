import { redirect } from "next/navigation";
import { requireUser } from "@/auth-server";
import { UnauthorizedError } from "@/auth-helpers";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { InboundFormFields } from "../inbound-form-fields";

export default async function NewInboundFormPage() {
  let me: Awaited<ReturnType<typeof requireUser>>;
  try {
    me = await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in?from=/inbound/new");
    throw err;
  }

  return (
    <AppShell user={me}>
      <div className="mx-auto max-w-lg">
        <PageHeader
          title="New Inbound Shipment"
          description="Submit for the manager's approval. Stock is added once approved."
        />
        <InboundFormFields mode={{ kind: "create" }} />
      </div>
    </AppShell>
  );
}
