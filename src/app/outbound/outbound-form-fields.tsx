"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PartyPicker } from "@/components/party-picker";
import { ProductPicker } from "@/components/product-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormCard } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";
import {
  submitOutboundAction,
  editAndResubmitOutboundAction,
  type ActionResult,
} from "./actions";

type LineDefault = {
  product: { id: string; name: string };
  boxes: number;
  unitPriceGhs: string;
};

type Mode =
  | { kind: "create" }
  | {
      kind: "edit";
      formId: string;
      defaults: {
        customer: { id: string; name: string };
        lines: LineDefault[];
        dispatchDate: string;
        note: string | null;
      };
    };

type LineState = {
  key: number;
  product: { id: string; name: string } | null;
  boxes: string;
  unitPriceGhs: string;
};

let nextKey = 0;

function makeEmptyLine(): LineState {
  return { key: nextKey++, product: null, boxes: "", unitPriceGhs: "" };
}

function fromDefaults(defaults: LineDefault[]): LineState[] {
  return defaults.map((d) => ({
    key: nextKey++,
    product: d.product,
    boxes: String(d.boxes),
    unitPriceGhs: d.unitPriceGhs,
  }));
}

export function OutboundFormFields({ mode }: { mode: Mode }) {
  const action =
    mode.kind === "create"
      ? submitOutboundAction
      : editAndResubmitOutboundAction;

  const [state, formAction, isPending] = useActionState<
    ActionResult<{ id: string }> | null,
    FormData
  >(action, null);

  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      router.push(`/outbound/${state.data.id}`);
    }
  }, [state, router]);

  const [lines, setLines] = useState<LineState[]>(() =>
    mode.kind === "edit" && mode.defaults.lines.length > 0
      ? fromDefaults(mode.defaults.lines)
      : [makeEmptyLine()],
  );

  function addLine() {
    setLines((prev) => [...prev, makeEmptyLine()]);
  }

  function removeLine(key: number) {
    setLines((prev) => {
      const next = prev.filter((l) => l.key !== key);
      return next.length > 0 ? next : [makeEmptyLine()];
    });
  }

  function updateLineProduct(key: number, product: { id: string; name: string } | null) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, product } : l)),
    );
  }

  function updateLineBoxes(key: number, boxes: string) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, boxes } : l)),
    );
  }

  function updateLinePrice(key: number, unitPriceGhs: string) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, unitPriceGhs } : l)),
    );
  }

  const selectedProductIds = lines
    .map((l) => l.product?.id)
    .filter((id): id is string => id != null);

  // Compute preview total (GHS).
  const previewTotalGhs = lines.reduce((sum, l) => {
    const b = Number(l.boxes);
    const p = Number(l.unitPriceGhs);
    if (Number.isNaN(b) || Number.isNaN(p) || b <= 0 || p <= 0) return sum;
    return sum + b * p;
  }, 0);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction}>
      <FormCard>
        {mode.kind === "edit" && (
          <input type="hidden" name="formId" value={mode.formId} />
        )}

        <FormField label="Customer">
          <PartyPicker
            kind="customer"
            required
            initial={mode.kind === "edit" ? mode.defaults.customer : null}
          />
        </FormField>

        {/* Line items */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            Products
          </label>
          <div className="space-y-3">
            {lines.map((line, idx) => (
              <div key={line.key} className="rounded-lg border border-surface-border/60 p-3 space-y-2">
                {/* Hidden fields for form submission */}
                <input
                  type="hidden"
                  name={`lines[${idx}].productId`}
                  value={line.product?.id ?? ""}
                />
                <div className="flex gap-2 items-start">
                  <div className="flex-1 min-w-0">
                    <ProductPicker
                      name={`_lines[${idx}].productDisplay`}
                      required
                      initial={line.product}
                      exclude={selectedProductIds.filter(
                        (id) => id !== line.product?.id,
                      )}
                      onSelect={(p) => updateLineProduct(line.key, p)}
                      key={`picker-${line.key}`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    className="mt-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    aria-label="Remove line"
                  >
                    &times;
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    name={`lines[${idx}].boxes`}
                    required
                    min={1}
                    step={1}
                    inputMode="numeric"
                    placeholder="Boxes"
                    value={line.boxes}
                    onChange={(e) => updateLineBoxes(line.key, e.target.value)}
                  />
                  <Input
                    type="text"
                    name={`lines[${idx}].unitPriceGhs`}
                    required
                    inputMode="decimal"
                    pattern="^\d+(\.\d{1,2})?$"
                    placeholder="Price (GH₵)"
                    value={line.unitPriceGhs}
                    onChange={(e) => updateLinePrice(line.key, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addLine}
            className="mt-2 rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
          >
            + Add product
          </button>
        </div>

        {/* Total preview */}
        {previewTotalGhs > 0 ? (
          <div className="rounded-lg bg-zinc-50 p-4 ring-1 ring-surface-border">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-zinc-500">Total</span>
              <span className="font-mono font-semibold text-zinc-900">
                GH&#x20B5; {previewTotalGhs.toFixed(2)}
              </span>
            </div>
          </div>
        ) : null}

        <FormField label="Dispatch date">
          <Input
            type="date"
            name="dispatchDate"
            required
            defaultValue={mode.kind === "edit" ? mode.defaults.dispatchDate : today}
          />
        </FormField>

        <FormField label="Note" optional>
          <Textarea
            name="note"
            rows={3}
            defaultValue={mode.kind === "edit" ? mode.defaults.note ?? "" : ""}
            placeholder="Anything the manager should know"
          />
        </FormField>

        {state && !state.ok ? <Alert>{state.error}</Alert> : null}

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={isPending} className="flex-1" size="lg">
            {isPending
              ? "Submitting..."
              : mode.kind === "create"
                ? "Submit for approval"
                : "Resubmit"}
          </Button>
          <Link
            href="/outbound"
            className="flex-1 inline-flex items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-medium text-zinc-700 shadow-sm ring-1 ring-surface-border transition-colors hover:bg-zinc-50"
          >
            Cancel
          </Link>
        </div>
      </FormCard>
    </form>
  );
}
