"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager, requireUser } from "@/auth-server";
import {
  ProductError,
  createProduct as createProductCore,
  updateProduct as updateProductCore,
  deactivateProduct as deactivateProductCore,
  reactivateProduct as reactivateProductCore,
  searchActiveProducts,
} from "@/lib/products";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function toResult<T>(err: unknown): ActionResult<T> {
  if (err instanceof ProductError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Something went wrong. Please try again." };
}

function readProductFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? "") || null,
  };
}

export async function createProductAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireManager();
    const created = await createProductCore({ actor, ...readProductFields(formData) });
    revalidatePath("/products");
    return { ok: true, data: { id: created.id } };
  } catch (err) {
    return toResult(err);
  }
}

export async function updateProductAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireManager();
    const updated = await updateProductCore({
      actor,
      productId: String(formData.get("productId") ?? ""),
      ...readProductFields(formData),
    });
    revalidatePath("/products");
    revalidatePath(`/products/${updated.id}`);
    return { ok: true, data: { id: updated.id } };
  } catch (err) {
    return toResult(err);
  }
}

export async function deactivateProductAction(formData: FormData): Promise<void> {
  const actor = await requireManager();
  await deactivateProductCore({
    actor,
    productId: String(formData.get("productId") ?? ""),
  });
  revalidatePath("/products");
  revalidatePath(`/products/${formData.get("productId")}`);
}

export async function reactivateProductAction(formData: FormData): Promise<void> {
  const actor = await requireManager();
  await reactivateProductCore({
    actor,
    productId: String(formData.get("productId") ?? ""),
  });
  revalidatePath("/products");
  revalidatePath(`/products/${formData.get("productId")}`);
}

/**
 * Public to any signed-in user — workers will call this from the ProductPicker
 * when filling inbound/outbound forms.
 */
export async function searchProductsAction(q: string) {
  await requireUser();
  return searchActiveProducts(q);
}

export async function redirectToProductsList(): Promise<void> {
  redirect("/products");
}
