import { redirect } from "next/navigation";
import { requireManager } from "@/auth-server";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { TopNav } from "@/components/top-nav";
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
    <>
      <TopNav user={me} />
      <main className="mx-auto max-w-md px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-semibold">New stock adjustment</h1>
          <p className="text-sm text-slate-500">
            Record damages, returns, or recount corrections. Goes straight
            into the ledger; no approval needed.
          </p>
        </header>

        <AdjustmentForm currentStock={currentStock} />
      </main>
    </>
  );
}
