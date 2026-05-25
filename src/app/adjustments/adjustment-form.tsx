"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormCard } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";
import { ProductPicker } from "@/components/product-picker";
import {
  recordAdjustmentAction,
  type ActionResult,
} from "./actions";
import { ADJUSTMENT_REASONS } from "@/lib/adjustments-shared";

type ProductStock = { productId: string; productName: string; total: number };

export function AdjustmentForm({
  currentStock,
  productStocks,
}: {
  currentStock: number;
  productStocks: ProductStock[];
}) {
  const [state, formAction, isPending] = useActionState<
    ActionResult<{ resultingStock: number }> | null,
    FormData
  >(recordAdjustmentAction, null);
  const router = useRouter();
  const [sign, setSign] = useState<"+" | "-">("-");
  const [magnitude, setMagnitude] = useState<number>(0);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  useEffect(() => {
    if (state?.ok) router.push("/adjustments");
  }, [state, router]);

  const selectedProductStock =
    selectedProductId != null
      ? productStocks.find((p) => p.productId === selectedProductId)?.total ?? 0
      : currentStock;

  const resultingStock = sign === "-" ? selectedProductStock - magnitude : selectedProductStock + magnitude;
  const wouldGoNegative = resultingStock < 0;

  return (
    <form action={formAction}>
      <FormCard>
        {/* Product picker */}
        <FormField label="Product">
          <ProductPicker
            name="productId"
            required
            onSelect={(p) => setSelectedProductId(p?.id ?? null)}
          />
        </FormField>

        {/* Stock preview */}
        <div className="rounded-lg bg-zinc-50 p-4 ring-1 ring-surface-border">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-zinc-500">
              {selectedProductId ? "Product stock" : "Total stock"}
            </span>
            <span className="font-mono font-medium text-zinc-900">
              {selectedProductStock} boxes
            </span>
          </div>
          {magnitude > 0 ? (
            <div className="mt-1.5 flex items-baseline justify-between text-sm">
              <span className="text-zinc-500">After adjustment</span>
              <span
                className={`font-mono font-semibold ${
                  wouldGoNegative ? "text-rose-600" : "text-zinc-900"
                }`}
              >
                {resultingStock} boxes
              </span>
            </div>
          ) : null}
        </div>

        {/* Direction */}
        <fieldset>
          <legend className="text-sm font-medium text-zinc-700 mb-2">Direction</legend>
          <div className="flex gap-3">
            <label
              className={`flex-1 cursor-pointer rounded-lg border-2 px-4 py-3 text-center text-sm font-semibold transition-all ${
                sign === "-"
                  ? "border-rose-400 bg-rose-50 text-rose-800"
                  : "border-surface-border bg-white text-zinc-500 hover:bg-zinc-50"
              }`}
            >
              <input
                type="radio"
                name="sign"
                value="-"
                checked={sign === "-"}
                onChange={() => setSign("-")}
                className="sr-only"
              />
              Remove boxes
            </label>
            <label
              className={`flex-1 cursor-pointer rounded-lg border-2 px-4 py-3 text-center text-sm font-semibold transition-all ${
                sign === "+"
                  ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                  : "border-surface-border bg-white text-zinc-500 hover:bg-zinc-50"
              }`}
            >
              <input
                type="radio"
                name="sign"
                value="+"
                checked={sign === "+"}
                onChange={() => setSign("+")}
                className="sr-only"
              />
              Add boxes
            </label>
          </div>
        </fieldset>

        <FormField label="Boxes">
          <Input
            type="number"
            name="magnitude"
            required
            min={1}
            step={1}
            inputMode="numeric"
            value={magnitude || ""}
            onChange={(e) => setMagnitude(Number(e.target.value))}
          />
        </FormField>

        <FormField label="Reason">
          <Select name="reason" required defaultValue="">
            <option value="" disabled>
              Pick a reason...
            </option>
            {ADJUSTMENT_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Note" optional>
          <Textarea
            name="note"
            rows={3}
            placeholder="Detail for the audit trail"
          />
        </FormField>

        {state && !state.ok ? <Alert>{state.error}</Alert> : null}

        <div className="flex gap-3 pt-1">
          <Button
            type="submit"
            disabled={isPending || magnitude <= 0 || wouldGoNegative || !selectedProductId}
            className="flex-1"
            size="lg"
          >
            {isPending ? "Recording..." : "Record adjustment"}
          </Button>
          <Link
            href="/adjustments"
            className="flex-1 inline-flex items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-medium text-zinc-700 shadow-sm ring-1 ring-surface-border transition-colors hover:bg-zinc-50"
          >
            Cancel
          </Link>
        </div>
      </FormCard>
    </form>
  );
}
