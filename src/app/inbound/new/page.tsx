import { redirect } from "next/navigation";
import { requireUser } from "@/auth-server";
import { UnauthorizedError } from "@/auth-helpers";
import { TopNav } from "@/components/top-nav";
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
    <>
      <TopNav user={me} />
      <main className="mx-auto max-w-md px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-semibold">New inbound shipment</h1>
          <p className="text-sm text-slate-500">
            Submit for the manager&apos;s approval. Stock is added once approved.
          </p>
        </header>

        <InboundFormFields mode={{ kind: "create" }} />
      </main>
    </>
  );
}
