import { redirect } from "next/navigation";
import Image from "next/image";
import { auth, signIn } from "@/auth";
import { AuthError } from "next-auth";
import { IconMail } from "@/components/icons";
import { PasswordField } from "./password-field";

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
    <main className="sign-in-page relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-12">
      {/* ── Background layers ── */}

      {/* Base: warm surface with a radial warm-to-cool shift */}
      <div className="absolute inset-0 bg-surface" />
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(27,107,58,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Warehouse grid — large structural lines + fine detail grid */}
      <div className="sign-in-grid absolute inset-0 opacity-[0.35]" />

      {/* Floating gradient orbs for depth */}
      <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-brand-green/[0.06] blur-[100px]" />
      <div className="absolute -bottom-32 -left-32 h-[450px] w-[450px] rounded-full bg-brand-pink/[0.06] blur-[90px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[700px] w-[700px] rounded-full bg-brand-green/[0.04] blur-[120px]" />

      {/* Decorative corner marks — warehouse floor markings vibe */}
      <div className="absolute top-8 left-8 h-16 w-16 border-l-2 border-t-2 border-brand-green/10 rounded-tl-sm" />
      <div className="absolute top-8 right-8 h-16 w-16 border-r-2 border-t-2 border-brand-green/10 rounded-tr-sm" />
      <div className="absolute bottom-8 left-8 h-16 w-16 border-l-2 border-b-2 border-brand-pink/15 rounded-bl-sm" />
      <div className="absolute bottom-8 right-8 h-16 w-16 border-r-2 border-b-2 border-brand-pink/15 rounded-br-sm" />

      {/* Noise texture overlay for tactile feel */}
      <div className="absolute inset-0 sign-in-noise opacity-[0.3]" />

      {/* ── Content ── */}
      <div className="relative z-10 w-full max-w-[400px]">
        {/* Logo + brand */}
        <div className="sign-in-stagger-1 mb-10 flex flex-col items-center text-center">
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-xl shadow-brand-green/15 ring-1 ring-surface-border">
            <Image
              src="/logo.jpeg"
              alt="FLO 360 Global"
              width={72}
              height={72}
              className="rounded-full"
              priority
            />
          </div>
          <h1 className="font-display text-[1.85rem] font-bold tracking-tight text-zinc-900">
            FLO 360 Global
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            Warehouse inventory management
          </p>
        </div>

        {/* Form card — frosted glass on warm surface */}
        <div className="sign-in-stagger-2 rounded-2xl bg-white/70 p-7 shadow-xl shadow-black/[0.04] ring-1 ring-surface-border backdrop-blur-sm">
          <h2 className="mb-1 text-lg font-semibold text-zinc-800">Sign in</h2>
          <p className="mb-6 text-[13px] text-zinc-500">
            Enter your credentials to access the dashboard.
          </p>

          {/* Error alert */}
          {error === "invalid" && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 rounded-xl bg-rose-50/80 px-4 py-3.5 ring-1 ring-rose-200/60"
            >
              <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-rose-100">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-rose-600">
                  <path d="M6 4v2.5M6 8.5h.005" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-rose-800">Invalid credentials</p>
                <p className="mt-0.5 text-xs text-rose-600">
                  Check your email and password and try again.
                </p>
              </div>
            </div>
          )}

          <form action={signInAction} className="space-y-4">
            <input type="hidden" name="from" value={safeFrom} />

            <div className="sign-in-stagger-3">
              <label htmlFor="sign-in-email" className="mb-1.5 block text-sm font-medium text-zinc-700">
                Email
              </label>
              <div className="relative">
                <IconMail
                  width={16}
                  height={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
                />
                <input
                  id="sign-in-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  placeholder="you@company.com"
                  className="block w-full rounded-xl border border-surface-border-strong/80 bg-white px-4 py-3 pl-11 text-sm text-zinc-900 shadow-sm transition-all placeholder:text-zinc-400 hover:border-zinc-300 hover:shadow-md focus-ring"
                />
              </div>
            </div>

            <PasswordField />

            <div className="sign-in-stagger-5 pt-2">
              <button
                type="submit"
                className="group relative w-full overflow-hidden rounded-xl bg-sidebar px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sidebar/15 transition-all hover:shadow-xl hover:shadow-sidebar/20 hover:-translate-y-px active:translate-y-0 active:shadow-md focus-ring"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Sign in
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="transition-transform group-hover:translate-x-0.5">
                    <path d="M3.5 8h9M9 4.5L12.5 8 9 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {/* Shimmer effect on hover */}
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <p className="sign-in-stagger-5 mt-7 text-center text-xs leading-relaxed text-zinc-400">
          Access restricted to authorized personnel.
          <br />
          Contact your manager for account issues.
        </p>
      </div>
    </main>
  );
}
