"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PartyPicker } from "@/components/party-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormCard } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";
import {
  submitOutboundAction,
  editAndResubmitOutboundAction,
  quoteOutboundStockAction,
  type ActionResult,
} from "./actions";

type Mode =
  | { kind: "create"; currentStock: number }
  | {
      kind: "edit";
      formId: string;
      currentStock: number;
      defaults: {
        customer: { id: string; name: string };
        boxes: number;
        unitPriceGhs: string;
        dispatchDate: string;
        note: string | null;
      };
    };

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
  const [boxes, setBoxes] = useState<number>(
    mode.kind === "edit" ? mode.defaults.boxes : 0,
  );
  const [unitPriceGhs, setUnitPriceGhs] = useState<string>(
    mode.kind === "edit" ? mode.defaults.unitPriceGhs : "",
  );
  const [quotedStock, setQuotedStock] = useState<number>(mode.currentStock);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (state?.ok) {
      router.push(`/outbound/${state.data.id}`);
    }
  }, [state, router]);

  useEffect(() => {
    if (boxes <= 0) return;
    const handle = setTimeout(() => {
      startTransition(async () => {
        const q = await quoteOutboundStockAction(boxes);
        setQuotedStock(q.currentStock);
      });
    }, 300);
    return () => clearTimeout(handle);
  }, [boxes]);

  const exceedsStock = boxes > 0 && boxes > quotedStock;
  const today = new Date().toISOString().slice(0, 10);
  const priceNumeric = Number(unitPriceGhs);
  const previewTotalGhs =
    !Number.isNaN(priceNumeric) && boxes > 0
      ? (priceNumeric * boxes).toFixed(2)
      : null;

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

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Boxes">
            <Input
              type="number"
              name="boxes"
              required
              min={1}
              step={1}
              inputMode="numeric"
              value={boxes || ""}
              onChange={(e) => setBoxes(Number(e.target.value))}
            />
          </FormField>

          <FormField label="Unit price (GH&#x20B5;)">
            <Input
              type="text"
              name="unitPriceGhs"
              required
              inputMode="decimal"
              pattern="^\d+(\.\d{1,2})?$"
              value={unitPriceGhs}
              onChange={(e) => setUnitPriceGhs(e.target.value)}
              placeholder="50.00"
            />
          </FormField>
        </div>

        {/* Stock + total preview */}
        <div className="rounded-lg bg-zinc-50 p-4 ring-1 ring-surface-border">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-zinc-500">Current stock</span>
            <span className="font-mono font-medium text-zinc-900">{quotedStock} boxes</span>
          </div>
          {previewTotalGhs ? (
            <div className="mt-1.5 flex items-baseline justify-between text-sm">
              <span className="text-zinc-500">Total</span>
              <span className="font-mono font-semibold text-zinc-900">GH&#x20B5; {previewTotalGhs}</span>
            </div>
          ) : null}
          {exceedsStock ? (
            <p className="mt-2 text-sm font-medium text-rose-600">
              Requested boxes exceed current stock. Reduce the quantity.
            </p>
          ) : null}
        </div>

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
          <Button
            type="submit"
            disabled={isPending || exceedsStock || boxes <= 0}
            className="flex-1"
            size="lg"
          >
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
