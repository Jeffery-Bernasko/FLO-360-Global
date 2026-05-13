"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormCard } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";
import {
  createSupplierAction,
  updateSupplierAction,
  type ActionResult,
} from "./actions";
import type { Supplier } from "@/db/schema";

type Props = {
  supplier?: Supplier;
  successHref?: string;
};

export function SupplierForm({ supplier, successHref = "/suppliers" }: Props) {
  const isEdit = Boolean(supplier);
  const action = isEdit ? updateSupplierAction : createSupplierAction;
  const [state, formAction, isPending] = useActionState<
    ActionResult<{ id: string }> | null,
    FormData
  >(action, null);

  const router = useRouter();

  useEffect(() => {
    if (state?.ok) router.push(successHref);
  }, [state, router, successHref]);

  return (
    <form action={formAction}>
      <FormCard>
        {supplier ? (
          <input type="hidden" name="supplierId" value={supplier.id} />
        ) : null}

        <FormField label="Name">
          <Input
            type="text"
            name="name"
            required
            defaultValue={supplier?.name ?? ""}
          />
        </FormField>

        <FormField label="Country" optional>
          <Input
            type="text"
            name="country"
            defaultValue={supplier?.country ?? ""}
          />
        </FormField>

        <FormField label="Contact" optional>
          <Input
            type="text"
            name="contact"
            defaultValue={supplier?.contact ?? ""}
            placeholder="Email, phone, or person"
          />
        </FormField>

        <FormField label="Notes" optional>
          <Textarea
            name="notes"
            rows={3}
            defaultValue={supplier?.notes ?? ""}
          />
        </FormField>

        {state && !state.ok ? <Alert>{state.error}</Alert> : null}

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={isPending} className="flex-1" size="lg">
            {isPending ? "Saving..." : isEdit ? "Save changes" : "Create supplier"}
          </Button>
          <Link
            href="/suppliers"
            className="flex-1 inline-flex items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-medium text-zinc-700 shadow-sm ring-1 ring-surface-border transition-colors hover:bg-zinc-50"
          >
            Cancel
          </Link>
        </div>
      </FormCard>
    </form>
  );
}
