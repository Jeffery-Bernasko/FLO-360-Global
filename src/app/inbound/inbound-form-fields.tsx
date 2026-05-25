"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { PartyPicker } from "@/components/party-picker";
import { ProductPicker } from "@/components/product-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormCard } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";
import {
  submitInboundAction,
  editAndResubmitInboundAction,
  type ActionResult,
} from "./actions";

type LineDefault = {
  product: { id: string; name: string };
  boxes: number;
};

type Mode =
  | { kind: "create" }
  | {
      kind: "edit";
      formId: string;
      defaults: {
        supplier: { id: string; name: string };
        lines: LineDefault[];
        receivedDate: string;
        note: string | null;
      };
    };

type LineState = {
  key: number;
  product: { id: string; name: string } | null;
  boxes: string;
};

let nextKey = 0;

function makeEmptyLine(): LineState {
  return { key: nextKey++, product: null, boxes: "" };
}

function fromDefaults(defaults: LineDefault[]): LineState[] {
  return defaults.map((d) => ({
    key: nextKey++,
    product: d.product,
    boxes: String(d.boxes),
  }));
}

export function InboundFormFields({ mode }: { mode: Mode }) {
  const action =
    mode.kind === "create"
      ? submitInboundAction
      : editAndResubmitInboundAction;

  const [state, formAction, isPending] = useActionState<
    ActionResult<{ id: string }> | null,
    FormData
  >(action, null);

  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      router.push(`/inbound/${state.data.id}`);
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

  // Collect selected product IDs for exclusion in pickers.
  const selectedProductIds = lines
    .map((l) => l.product?.id)
    .filter((id): id is string => id != null);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} encType="multipart/form-data">
      <FormCard>
        {mode.kind === "edit" && (
          <input type="hidden" name="formId" value={mode.formId} />
        )}

        <FormField label="Supplier">
          <PartyPicker
            kind="supplier"
            required
            initial={mode.kind === "edit" ? mode.defaults.supplier : null}
          />
        </FormField>

        {/* Line items */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            Products
          </label>
          <div className="space-y-3">
            {lines.map((line, idx) => (
              <div key={line.key} className="flex gap-2 items-start">
                {/* Hidden fields for form submission */}
                <input
                  type="hidden"
                  name={`lines[${idx}].productId`}
                  value={line.product?.id ?? ""}
                />
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
                <div className="w-24 flex-shrink-0">
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

        <FormField label="Date received">
          <Input
            type="date"
            name="receivedDate"
            required
            defaultValue={mode.kind === "edit" ? mode.defaults.receivedDate : today}
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

        <FormField
          label="Photo of waybill / invoice"
          optional
          hint={mode.kind === "edit" ? "Pick a new file to replace, or leave empty to keep it." : undefined}
        >
          <input
            type="file"
            name="attachment"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 file:transition-colors file:cursor-pointer"
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
            href="/inbound"
            className="flex-1 inline-flex items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-medium text-zinc-700 shadow-sm ring-1 ring-surface-border transition-colors hover:bg-zinc-50"
          >
            Cancel
          </Link>
        </div>
      </FormCard>
    </form>
  );
}
