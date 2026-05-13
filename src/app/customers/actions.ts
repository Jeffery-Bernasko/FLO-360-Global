"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager, requireUser } from "@/auth-server";
import {
  PartyError,
  createCustomer as createCustomerCore,
  updateCustomer as updateCustomerCore,
  deactivateCustomer as deactivateCustomerCore,
  reactivateCustomer as reactivateCustomerCore,
  searchActiveCustomers,
} from "@/lib/customers";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function toResult<T>(err: unknown): ActionResult<T> {
  if (err instanceof PartyError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Something went wrong. Please try again." };
}

function readPartyFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? "") || null,
    location: String(formData.get("location") ?? "") || null,
    notes: String(formData.get("notes") ?? "") || null,
  };
}

export async function createCustomerAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireManager();
    const created = await createCustomerCore({ actor, ...readPartyFields(formData) });
    revalidatePath("/customers");
    return { ok: true, data: { id: created.id } };
  } catch (err) {
    return toResult(err);
  }
}

export async function updateCustomerAction(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireManager();
    const updated = await updateCustomerCore({
      actor,
      customerId: String(formData.get("customerId") ?? ""),
      ...readPartyFields(formData),
    });
    revalidatePath("/customers");
    revalidatePath(`/customers/${updated.id}`);
    return { ok: true, data: { id: updated.id } };
  } catch (err) {
    return toResult(err);
  }
}

export async function deactivateCustomerAction(formData: FormData): Promise<void> {
  const actor = await requireManager();
  await deactivateCustomerCore({
    actor,
    customerId: String(formData.get("customerId") ?? ""),
  });
  revalidatePath("/customers");
  revalidatePath(`/customers/${formData.get("customerId")}`);
}

export async function reactivateCustomerAction(formData: FormData): Promise<void> {
  const actor = await requireManager();
  await reactivateCustomerCore({
    actor,
    customerId: String(formData.get("customerId") ?? ""),
  });
  revalidatePath("/customers");
  revalidatePath(`/customers/${formData.get("customerId")}`);
}

/**
 * Public to any signed-in user — workers will call this from the PartyPicker
 * when filling outbound forms (F6).
 */
export async function searchCustomersAction(q: string) {
  await requireUser();
  return searchActiveCustomers(q);
}

export async function redirectToCustomersList(): Promise<void> {
  redirect("/customers");
}
