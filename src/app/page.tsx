import { requireUser } from "@/auth-server";
import { TopNav } from "@/components/top-nav";

export default async function HomePage() {
  const user = await requireUser();

  return (
    <>
      <TopNav user={user} />
      <main className="mx-auto max-w-md px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-semibold">Welcome, {user.name}</h1>
          <p className="text-sm text-slate-500">
            {user.role === "manager"
              ? "Manager dashboard, current stock, and approvals land in later features."
              : "Worker home. Submit inbound and outbound forms in later features."}
          </p>
        </header>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">Signed in as</p>
          <p className="mt-1 text-base font-medium">{user.email}</p>
          <p className="mt-2 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
            {user.role === "manager" ? "Manager" : "Worker"}
          </p>
        </section>
      </main>
    </>
  );
}
