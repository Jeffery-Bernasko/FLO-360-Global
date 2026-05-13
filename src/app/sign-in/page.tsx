import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { AuthError } from "next-auth";

type SearchParams = Promise<{ error?: string; from?: string }>;

export default async function SignInPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const { error, from } = await searchParams;

  async function signInAction(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const dest = String(formData.get("from") ?? "/");

    try {
      await signIn("credentials", {
        email,
        password,
        redirectTo: dest || "/",
      });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect(`/sign-in?error=invalid&from=${encodeURIComponent(dest)}`);
      }
      throw err;
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-semibold">FLO 360 Global</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to continue</p>
      </header>

      <form
        action={signInAction}
        className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
      >
        <input type="hidden" name="from" value={from ?? "/"} />

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </label>

        {error === "invalid" && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
            Invalid email or password.
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-base font-medium text-white shadow-sm transition active:bg-slate-700"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
