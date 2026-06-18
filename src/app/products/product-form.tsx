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
  createProductAction,
  updateProductAction,
  type ActionResult,
} from "./actions";
import type { Product } from "@/db/schema";

type Props = {
  product?: Product;
  successHref?: string;
};

export function ProductForm({ product, successHref = "/products" }: Props) {
  const isEdit = Boolean(product);
  const action = isEdit ? updateProductAction : createProductAction;
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
        {product ? (
          <input type="hidden" name="productId" value={product.id} />
        ) : null}

        <FormField label="Name">
          <Input
            type="text"
            name="name"
            required
            defaultValue={product?.name ?? ""}
          />
        </FormField>

        <FormField label="Description" optional>
          <Textarea
            name="description"
            rows={3}
            defaultValue={product?.description ?? ""}
          />
        </FormField>

        {state && !state.ok ? <Alert>{state.error}</Alert> : null}

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={isPending} className="flex-1" size="lg">
            {isPending ? "Saving..." : isEdit ? "Save changes" : "Create product"}
          </Button>
          <Link
            href="/products"
            className="flex-1 inline-flex items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-medium text-zinc-700 shadow-sm ring-1 ring-surface-border transition-colors hover:bg-zinc-50"
          >
            Cancel
          </Link>
        </div>
      </FormCard>
    </form>
  );
}
