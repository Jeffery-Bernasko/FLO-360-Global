"use server";

import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { requireUser } from "@/auth-server";
import { UnauthorizedError } from "@/auth-helpers";
import { changeOwnPassword, UserError } from "@/lib/users";

export type ChangePasswordActionResult =
  | { ok: true }
  | { ok: false; error: string };

function toSafeRedirectPath(value: string | undefined): string {
  const path = (value ?? "").trim();
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  if (path === "/change-password") return "/";
  return path;
}

function toResult(err: unknown): ChangePasswordActionResult {
  if (err instanceof UnauthorizedError) {
    return { ok: false, error: "You must be signed in to continue." };
  }
  if (err instanceof UserError) {
    return { ok: false, error: err.message };
  }
  if (err instanceof AuthError) {
    return {
      ok: false,
      error: "Password changed, but we could not refresh your session. Sign in again.",
    };
  }
  console.error(err);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function changePasswordAction(
  _prev: ChangePasswordActionResult | null,
  formData: FormData,
): Promise<ChangePasswordActionResult> {
  const destination = toSafeRedirectPath(String(formData.get("from") ?? "/"));
  const newPassword = String(formData.get("newPassword") ?? "");

  try {
    const actor = await requireUser();
    await changeOwnPassword({
      actor,
      newPassword,
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    });

    await signIn("credentials", {
      email: actor.email,
      password: newPassword,
      redirectTo: destination,
    });
    return { ok: true };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return toResult(err);
  }
}

export async function redirectAfterPasswordSetup(from: string): Promise<void> {
  redirect(toSafeRedirectPath(from));
}
