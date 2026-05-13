import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { AuthError } from "next-auth";
import { IconBox } from "@/components/icons";

type SearchParams = Promise<{ error?: string; from?: string }>;

function toSafeRedirectPath(value: string | undefined): string {
  const path = (value ?? "").trim();
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  return path;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const { error, from } = await searchParams;
  const safeFrom = toSafeRedirectPath(from);

  async function signInAction(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const dest = toSafeRedirectPath(String(formData.get("from") ?? "/"));

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
    <main className="flex min-h-dvh items-center justify-center bg-sidebar px-4 py-10">
      {/* Subtle grid pattern */}
      <div className="fixed inset-0 opacity-[0.03]" style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }} />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-600 shadow-lg shadow-teal-600/30">
            <IconBox width={28} height={28} className="text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">
            FLO 360 Global
          </h1>
          <p className="mt-1 text-sm text-sidebar-text">
            Sign in to your warehouse account
          </p>
        </div>

        {/* Form card */}
        <form
          action={signInAction}
          className="space-y-5 rounded-2xl bg-white p-6 shadow-2xl shadow-black/20 ring-1 ring-white/10"
        >
          <input type="hidden" name="from" value={safeFrom} />

          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              className="mt-1.5 block w-full rounded-lg border border-surface-border bg-white px-3 py-2.5 text-sm shadow-sm placeholder:text-zinc-400 focus-ring"
              placeholder="you@company.com"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              className="mt-1.5 block w-full rounded-lg border border-surface-border bg-white px-3 py-2.5 text-sm shadow-sm placeholder:text-zinc-400 focus-ring"
            />
          </label>

          {error === "invalid" && (
            <div role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
              Invalid email or password.
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-800 active:bg-teal-900 focus-ring"
          >
            Sign in
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-sidebar-text/60">
          Warehouse inventory management system
        </p>
      </div>
    </main>
  );
}
