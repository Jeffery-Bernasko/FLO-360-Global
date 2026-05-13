"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth-server";
import {
  OutboundFormError,
  editAndResubmitOutbound,
  quoteOutbound,
  submitOutbound,
} from "@/lib/outbound-forms";
import { parseGhsToPesewas } from "@/lib/money";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function toResult<T>(err: unknown): ActionResult<T> {
  if (err instanceof OutboundFormError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Something went wrong. Please try again." };
}

function readPriceFromForm(formData: FormData): number {
  // The form sends a plain decimal string in GHS (e.g. "50" or "50.00").
  const raw = String(formData.get("unitPriceGhs") ?? "");
  const pesewas = parseGhsToPesewas(raw);
  if (pesewas == null) {
    throw new OutboundFormError("invalid", "Unit price must be a valid GHS amount.");
  }
  return pesewas;
}

export async function submitOutboundAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireUser();
    const unitPricePesewas = readPriceFromForm(formData);

    const created = await submitOutbound({
      actor,
      customerId: String(formData.get("customerId") ?? ""),
      boxes: String(formData.get("boxes") ?? ""),
      unitPricePesewas,
      dispatchDate: String(formData.get("dispatchDate") ?? ""),
      note: String(formData.get("note") ?? "") || null,
    });

    revalidatePath("/outbound");
    revalidatePath("/approvals/outbound");
    return { ok: true, data: { id: String(created.id) } };
  } catch (err) {
    return toResult(err);
  }
}

export async function editAndResubmitOutboundAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireUser();
    const formId = BigInt(String(formData.get("formId") ?? "0"));
    if (!formId) return { ok: false, error: "Missing form id." };
    const unitPricePesewas = readPriceFromForm(formData);

    const updated = await editAndResubmitOutbound({
      actor,
      formId,
      customerId: String(formData.get("customerId") ?? ""),
      boxes: String(formData.get("boxes") ?? ""),
      unitPricePesewas,
      dispatchDate: String(formData.get("dispatchDate") ?? ""),
      note: String(formData.get("note") ?? "") || null,
    });

    revalidatePath("/outbound");
    revalidatePath(`/outbound/${formId}`);
    revalidatePath("/approvals/outbound");
    return { ok: true, data: { id: String(updated.id) } };
  } catch (err) {
    return toResult(err);
  }
}

export async function quoteOutboundStockAction(boxes: number): Promise<{
  currentStock: number;
  ok: boolean;
}> {
  await requireUser();
  return quoteOutbound({ boxes });
}

export async function redirectToOutboundList(): Promise<void> {
  redirect("/outbound");
}
