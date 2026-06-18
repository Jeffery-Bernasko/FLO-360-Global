"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/auth-server";
import {
  OutboundFormError,
  approveOutbound,
  rejectOutbound,
} from "@/lib/outbound-forms";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function toResult<T>(err: unknown): ActionResult<T> {
  if (err instanceof OutboundFormError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function approveOutboundAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireManager();
    const formId = BigInt(String(formData.get("formId") ?? "0"));
    if (!formId) return { ok: false, error: "Missing form id." };

    const updated = await approveOutbound({ actor, formId });
    revalidatePath("/");
    revalidatePath("/approvals");
    revalidatePath("/approvals/outbound");
    revalidatePath(`/approvals/outbound/${formId}`);
    revalidatePath("/outbound");
    revalidatePath(`/outbound/${formId}`);
    revalidatePath("/adjustments");
    return { ok: true, data: { id: String(updated.id) } };
  } catch (err) {
    return toResult(err);
  }
}

export async function rejectOutboundAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireManager();
    const formId = BigInt(String(formData.get("formId") ?? "0"));
    const reason = String(formData.get("reason") ?? "");
    if (!formId) return { ok: false, error: "Missing form id." };

    const updated = await rejectOutbound({ actor, formId, reason });
    revalidatePath("/");
    revalidatePath("/approvals");
    revalidatePath("/approvals/outbound");
    revalidatePath(`/approvals/outbound/${formId}`);
    revalidatePath("/outbound");
    revalidatePath(`/outbound/${formId}`);
    return { ok: true, data: { id: String(updated.id) } };
  } catch (err) {
    return toResult(err);
  }
}
