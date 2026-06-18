"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth-server";
import {
  OutboundFormError,
  editAndResubmitOutbound,
  submitOutbound,
} from "@/lib/outbound-forms";
import { getStockForProduct } from "@/lib/stock-ledger";
import { parseGhsToPesewas } from "@/lib/money";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function toResult<T>(err: unknown): ActionResult<T> {
  if (err instanceof OutboundFormError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Something went wrong. Please try again." };
}

function readLines(formData: FormData) {
  const lines: { productId: string; boxes: number; unitPricePesewas: number }[] = [];
  for (let i = 0; ; i++) {
    const productId = formData.get(`lines[${i}].productId`);
    if (productId == null) break;
    const boxes = Number(formData.get(`lines[${i}].boxes`) ?? "0");
    const priceGhs = String(formData.get(`lines[${i}].unitPriceGhs`) ?? "");
    const pesewas = parseGhsToPesewas(priceGhs);
    if (pesewas == null) {
      throw new OutboundFormError(
        "invalid",
        `Unit price for line ${i + 1} must be a valid GHS amount.`,
      );
    }
    lines.push({ productId: String(productId), boxes, unitPricePesewas: pesewas });
  }
  return lines;
}

export async function submitOutboundAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireUser();
    const lines = readLines(formData);

    const created = await submitOutbound({
      actor,
      customerId: String(formData.get("customerId") ?? ""),
      lines,
      dispatchDate: String(formData.get("dispatchDate") ?? ""),
      note: String(formData.get("note") ?? "") || null,
    });

    revalidatePath("/");
    revalidatePath("/outbound");
    revalidatePath("/approvals");
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
    const lines = readLines(formData);

    const updated = await editAndResubmitOutbound({
      actor,
      formId,
      customerId: String(formData.get("customerId") ?? ""),
      lines,
      dispatchDate: String(formData.get("dispatchDate") ?? ""),
      note: String(formData.get("note") ?? "") || null,
    });

    revalidatePath("/");
    revalidatePath("/outbound");
    revalidatePath(`/outbound/${formId}`);
    revalidatePath("/approvals");
    revalidatePath("/approvals/outbound");
    return { ok: true, data: { id: String(updated.id) } };
  } catch (err) {
    return toResult(err);
  }
}

export async function quoteProductStockAction(
  productId: string,
): Promise<number> {
  await requireUser();
  return getStockForProduct(productId);
}

export async function redirectToOutboundList(): Promise<void> {
  redirect("/outbound");
}
