import { redirect } from "next/navigation";
import { requireManager } from "@/auth-server";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentStock } from "@/lib/stock-ledger";
import { AdjustmentForm } from "../adjustment-form";

export default async function NewAdjustmentPage() {
  let me: Awaited<ReturnType<typeof requireManager>>;
  try {
    me = await requireManager();
  } catch (err) {
    if (err instanceof UnauthorizedError)
      redirect("/sign-in?from=/adjustments/new");
    if (err instanceof ForbiddenError) redirect("/");
    throw err;
  }

  const currentStock = await getCurrentStock();

  return (
    <AppShell user={me}>
      <div className="mx-auto max-w-lg">
        <PageHeader
          title="New Stock Adjustment"
          description="Record damages, returns, or recount corrections. Goes straight into the ledger; no approval needed."
        />
        <AdjustmentForm currentStock={currentStock} />
      </div>
    </AppShell>
  );
}
