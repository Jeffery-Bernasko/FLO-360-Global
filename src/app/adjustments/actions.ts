"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/auth-server";
import {
  AdjustmentError,
  recordAdjustment,
} from "@/lib/adjustments";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function toResult<T>(err: unknown): ActionResult<T> {
  if (err instanceof AdjustmentError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function recordAdjustmentAction(
  _prev: ActionResult<{ resultingStock: number }> | null,
  formData: FormData,
): Promise<ActionResult<{ resultingStock: number }>> {
  try {
    const actor = await requireManager();

    // Convention: the form sends |boxes| and a sign radio ("+" or "-").
    const magnitudeRaw = String(formData.get("magnitude") ?? "");
    const sign = String(formData.get("sign") ?? "+");
    const magnitude = Number(magnitudeRaw);
    if (!Number.isFinite(magnitude)) {
      return { ok: false, error: "Boxes must be a number." };
    }
    const boxesDelta = sign === "-" ? -magnitude : magnitude;

    const result = await recordAdjustment({
      actor,
      boxesDelta,
      reason: String(formData.get("reason") ?? ""),
      note: String(formData.get("note") ?? "") || null,
    });

    revalidatePath("/adjustments");
    revalidatePath("/");
    return { ok: true, data: { resultingStock: result.resultingStock } };
  } catch (err) {
    return toResult(err);
  }
}
