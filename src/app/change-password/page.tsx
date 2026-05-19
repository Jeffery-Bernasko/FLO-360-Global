import Image from "next/image";
import { forbidden, redirect, unauthorized } from "next/navigation";
import { requireUser } from "@/auth-server";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { ChangePasswordForm } from "./change-password-form";

type SearchParams = Promise<{ from?: string }>;

function toSafeRedirectPath(value: string | undefined): string {
  const path = (value ?? "").trim();
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  if (path === "/change-password") return "/";
  return path;
}

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) unauthorized();
    if (err instanceof ForbiddenError) forbidden();
    throw err;
  }

  const { from } = await searchParams;
  const safeFrom = toSafeRedirectPath(from);
  if (!user.mustChangePassword) redirect(safeFrom);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface px-5 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-surface-border">
            <Image
              src="/logo.jpeg"
              alt="FLO 360 Global"
              width={56}
              height={56}
              className="rounded-full"
              priority
            />
          </div>
          <h1 className="font-display text-2xl font-bold text-zinc-900">
            Create your password
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            {user.name}, replace your temporary password before continuing.
          </p>
        </div>

        <ChangePasswordForm from={safeFrom} />
      </div>
    </main>
  );
}
