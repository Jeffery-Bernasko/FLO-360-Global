import { forbidden, unauthorized } from "next/navigation";
import { requireManager } from "@/auth-server";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { NewWorkerForm } from "./new-worker-form";

export default async function NewUserPage() {
  let me: Awaited<ReturnType<typeof requireManager>>;
  try {
    me = await requireManager();
  } catch (err) {
    if (err instanceof UnauthorizedError) unauthorized();
    if (err instanceof ForbiddenError) forbidden();
    throw err;
  }

  return (
    <AppShell user={me}>
      <div className="mx-auto max-w-lg">
        <PageHeader
          title="Add Worker"
          description="A temporary password will be generated. Hand it to the worker in person; they sign in with their email and that password."
        />
        <NewWorkerForm />
      </div>
    </AppShell>
  );
}
