"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager, requireUser } from "@/auth-server";
import { PartyError } from "@/lib/customers";
import {
  createSupplier as createSupplierCore,
  updateSupplier as updateSupplierCore,
  deactivateSupplier as deactivateSupplierCore,
  reactivateSupplier as reactivateSupplierCore,
  searchActiveSuppliers,
} from "@/lib/suppliers";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function toResult<T>(err: unknown): ActionResult<T> {
  if (err instanceof PartyError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Something went wrong. Please try again." };
}

function readSupplierFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    country: String(formData.get("country") ?? "") || null,
    contact: String(formData.get("contact") ?? "") || null,
    notes: String(formData.get("notes") ?? "") || null,
  };
}

export async function createSupplierAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireManager();
    const created = await createSupplierCore({ actor, ...readSupplierFields(formData) });
    revalidatePath("/suppliers");
    return { ok: true, data: { id: created.id } };
  } catch (err) {
    return toResult(err);
  }
}

export async function updateSupplierAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireManager();
    const updated = await updateSupplierCore({
      actor,
      supplierId: String(formData.get("supplierId") ?? ""),
      ...readSupplierFields(formData),
    });
    revalidatePath("/suppliers");
    revalidatePath(`/suppliers/${updated.id}`);
    return { ok: true, data: { id: updated.id } };
  } catch (err) {
    return toResult(err);
  }
}

export async function deactivateSupplierAction(formData: FormData): Promise<void> {
  const actor = await requireManager();
  await deactivateSupplierCore({
    actor,
    supplierId: String(formData.get("supplierId") ?? ""),
  });
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${formData.get("supplierId")}`);
}

export async function reactivateSupplierAction(formData: FormData): Promise<void> {
  const actor = await requireManager();
  await reactivateSupplierCore({
    actor,
    supplierId: String(formData.get("supplierId") ?? ""),
  });
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${formData.get("supplierId")}`);
}

export async function searchSuppliersAction(q: string) {
  await requireUser();
  return searchActiveSuppliers(q);
}

export async function redirectToSuppliersList(): Promise<void> {
  redirect("/suppliers");
}
