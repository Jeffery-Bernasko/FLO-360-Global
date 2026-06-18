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
  createCustomerAction,
  updateCustomerAction,
  type ActionResult,
} from "./actions";
import type { Customer } from "@/db/schema";

type Props = {
  customer?: Customer;
  successHref?: string;
};

export function CustomerForm({ customer, successHref = "/customers" }: Props) {
  const isEdit = Boolean(customer);
  const action = isEdit ? updateCustomerAction : createCustomerAction;
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
        {customer ? (
          <input type="hidden" name="customerId" value={customer.id} />
        ) : null}

        <FormField label="Name">
          <Input
            type="text"
            name="name"
            required
            defaultValue={customer?.name ?? ""}
          />
        </FormField>

        <FormField label="Phone" optional>
          <Input
            type="tel"
            name="phone"
            defaultValue={customer?.phone ?? ""}
          />
        </FormField>

        <FormField label="Location" optional>
          <Input
            type="text"
            name="location"
            defaultValue={customer?.location ?? ""}
          />
        </FormField>

        <FormField label="Notes" optional>
          <Textarea
            name="notes"
            rows={3}
            defaultValue={customer?.notes ?? ""}
          />
        </FormField>

        {state && !state.ok ? <Alert>{state.error}</Alert> : null}

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={isPending} className="flex-1" size="lg">
            {isPending ? "Saving..." : isEdit ? "Save changes" : "Create customer"}
          </Button>
          <Link
            href="/customers"
            className="flex-1 inline-flex items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-medium text-zinc-700 shadow-sm ring-1 ring-surface-border transition-colors hover:bg-zinc-50"
          >
            Cancel
          </Link>
        </div>
      </FormCard>
    </form>
  );
}
