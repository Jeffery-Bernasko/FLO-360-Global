"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/auth-server";
import {
  InboundFormError,
  approveInbound,
  rejectInbound,
} from "@/lib/inbound-forms";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function toResult<T>(err: unknown): ActionResult<T> {
  if (err instanceof InboundFormError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function approveInboundAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireManager();
    const formId = BigInt(String(formData.get("formId") ?? "0"));
    if (!formId) return { ok: false, error: "Missing form id." };

    const updated = await approveInbound({ actor, formId });
    revalidatePath("/approvals/inbound");
    revalidatePath(`/approvals/inbound/${formId}`);
    revalidatePath("/inbound");
    revalidatePath(`/inbound/${formId}`);
    revalidatePath("/internal/ledger-debug");
    return { ok: true, data: { id: String(updated.id) } };
  } catch (err) {
    return toResult(err);
  }
}

export async function rejectInboundAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireManager();
    const formId = BigInt(String(formData.get("formId") ?? "0"));
    const reason = String(formData.get("reason") ?? "");
    if (!formId) return { ok: false, error: "Missing form id." };

    const updated = await rejectInbound({ actor, formId, reason });
    revalidatePath("/approvals/inbound");
    revalidatePath(`/approvals/inbound/${formId}`);
    revalidatePath("/inbound");
    revalidatePath(`/inbound/${formId}`);
    return { ok: true, data: { id: String(updated.id) } };
  } catch (err) {
    return toResult(err);
  }
}
