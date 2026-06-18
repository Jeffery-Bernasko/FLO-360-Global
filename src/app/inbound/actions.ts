"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth-server";
import {
  AttachmentError,
  deleteAttachment,
  uploadAttachment,
} from "@/lib/attachments";
import {
  InboundFormError,
  editAndResubmitInbound,
  submitInbound,
  type LineItemInput,
} from "@/lib/inbound-forms";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function toResult<T>(err: unknown): ActionResult<T> {
  if (err instanceof InboundFormError) return { ok: false, error: err.message };
  if (err instanceof AttachmentError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Something went wrong. Please try again." };
}

async function maybeUploadAttachment(formData: FormData): Promise<string | null> {
  const file = formData.get("attachment");
  if (!(file instanceof File) || file.size === 0) return null;
  const result = await uploadAttachment({ prefix: "inbound", file });
  return result.key;
}

/**
 * Extract line items from FormData. The form submits arrays like:
 * lines[0].productId, lines[0].boxes, lines[1].productId, lines[1].boxes, ...
 */
function readLines(formData: FormData): LineItemInput[] {
  const lines: LineItemInput[] = [];
  for (let i = 0; ; i++) {
    const productId = formData.get(`lines[${i}].productId`);
    const boxes = formData.get(`lines[${i}].boxes`);
    if (productId == null) break;
    lines.push({
      productId: String(productId),
      boxes: String(boxes ?? "0"),
    });
  }
  return lines;
}

export async function submitInboundAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  let uploadedKey: string | null = null;
  try {
    const actor = await requireUser();
    uploadedKey = await maybeUploadAttachment(formData);

    const created = await submitInbound({
      actor,
      supplierId: String(formData.get("supplierId") ?? ""),
      lines: readLines(formData),
      receivedDate: String(formData.get("receivedDate") ?? ""),
      note: String(formData.get("note") ?? "") || null,
      attachmentKey: uploadedKey,
    });

    revalidatePath("/");
    revalidatePath("/inbound");
    revalidatePath("/approvals");
    revalidatePath("/approvals/inbound");
    return { ok: true, data: { id: String(created.id) } };
  } catch (err) {
    if (uploadedKey) await deleteAttachment(uploadedKey);
    return toResult(err);
  }
}

export async function editAndResubmitInboundAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  let uploadedKey: string | null = null;
  try {
    const actor = await requireUser();
    const formId = BigInt(String(formData.get("formId") ?? "0"));
    if (!formId) return { ok: false, error: "Missing form id." };

    uploadedKey = await maybeUploadAttachment(formData);

    const updated = await editAndResubmitInbound({
      actor,
      formId,
      supplierId: String(formData.get("supplierId") ?? ""),
      lines: readLines(formData),
      receivedDate: String(formData.get("receivedDate") ?? ""),
      note: String(formData.get("note") ?? "") || null,
      attachmentKey: uploadedKey ?? undefined,
    });

    revalidatePath("/");
    revalidatePath("/inbound");
    revalidatePath(`/inbound/${formId}`);
    revalidatePath("/approvals");
    revalidatePath("/approvals/inbound");
    return { ok: true, data: { id: String(updated.id) } };
  } catch (err) {
    if (uploadedKey) await deleteAttachment(uploadedKey);
    return toResult(err);
  }
}

export async function redirectToInboundList(): Promise<void> {
  redirect("/inbound");
}
