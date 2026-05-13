import { requireUser } from "@/auth-server";
import { signOut } from "@/auth";

export default async function HomePage() {
  const user = await requireUser();

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">FLO 360 Global</h1>
        <p className="text-sm text-slate-500">Warehouse inventory</p>
      </header>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm text-slate-500">Signed in as</p>
        <p className="mt-1 text-lg font-medium">{user.name}</p>
        <p className="text-sm text-slate-600">{user.email}</p>
        <p className="mt-3 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
          {user.role === "manager" ? "Manager" : "Worker"}
        </p>
      </section>

      <section className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
        Foundation only. Inventory, approvals, and reports land in later
        features.
      </section>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/sign-in" });
        }}
        className="mt-8"
      >
        <button
          type="submit"
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-base font-medium text-white shadow-sm transition active:bg-slate-700"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
