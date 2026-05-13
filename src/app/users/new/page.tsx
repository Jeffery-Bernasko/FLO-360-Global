import { forbidden, unauthorized } from "next/navigation";
import { requireManager } from "@/auth-server";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { TopNav } from "@/components/top-nav";
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
    <>
      <TopNav user={me} />
      <main className="mx-auto max-w-md px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-semibold">Add worker</h1>
          <p className="text-sm text-slate-500">
            A temporary password will be generated. Hand it to the worker
            in person; they sign in with their email and that password.
          </p>
        </header>

        <NewWorkerForm />
      </main>
    </>
  );
}
