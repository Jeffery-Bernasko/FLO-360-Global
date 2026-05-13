"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/auth-server";
import {
  createWorker as createWorkerCore,
  deactivateUser as deactivateUserCore,
  reactivateUser as reactivateUserCore,
  resetUserPassword as resetUserPasswordCore,
  UserError,
} from "@/lib/users";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function toResult<T>(err: unknown): ActionResult<T> {
  if (err instanceof UserError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function createWorkerAction(
  _prev: ActionResult<{ tempPassword: string; email: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ tempPassword: string; email: string }>> {
  try {
    const actor = await requireManager();
    const result = await createWorkerCore({
      actor,
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
    });
    revalidatePath("/users");
    return {
      ok: true,
      data: { tempPassword: result.tempPassword, email: result.email },
    };
  } catch (err) {
    return toResult(err);
  }
}

export async function deactivateUserAction(formData: FormData): Promise<void> {
  const actor = await requireManager();
  await deactivateUserCore({
    actor,
    targetUserId: String(formData.get("userId") ?? ""),
  });
  revalidatePath("/users");
}

export async function reactivateUserAction(formData: FormData): Promise<void> {
  const actor = await requireManager();
  await reactivateUserCore({
    actor,
    targetUserId: String(formData.get("userId") ?? ""),
  });
  revalidatePath("/users");
}

export async function resetUserPasswordAction(
  _prev: ActionResult<{ userId: string; tempPassword: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ userId: string; tempPassword: string }>> {
  try {
    const actor = await requireManager();
    const result = await resetUserPasswordCore({
      actor,
      targetUserId: String(formData.get("userId") ?? ""),
    });
    revalidatePath("/users");
    return { ok: true, data: result };
  } catch (err) {
    return toResult(err);
  }
}

export async function redirectToUsers(): Promise<void> {
  redirect("/users");
}
