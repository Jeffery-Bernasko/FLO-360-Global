"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/auth-server";
import { recordMovement } from "@/lib/stock-ledger";

export async function recordDebugAdjustment(formData: FormData): Promise<void> {
  const actor = await requireManager();
  const delta = Number(formData.get("delta") ?? 0);
  if (!Number.isInteger(delta) || delta === 0) return;

  await recordMovement({
    kind: "adjustment",
    boxesDelta: delta,
    reason: "Debug",
    actor: { id: actor.id },
  });

  revalidatePath("/internal/ledger-debug");
}
