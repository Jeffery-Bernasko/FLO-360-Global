"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PartyPicker } from "@/components/party-picker";
import {
  submitOutboundAction,
  editAndResubmitOutboundAction,
  quoteOutboundStockAction,
  type ActionResult,
} from "./actions";

const inputClass =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900";

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

  // Refresh the stock quote when the worker changes the boxes value.
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
    <form
      action={formAction}
      className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
    >
      {mode.kind === "edit" && (
        <input type="hidden" name="formId" value={mode.formId} />
      )}

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Customer</span>
        <div className="mt-1">
          <PartyPicker
            kind="customer"
            required
            initial={mode.kind === "edit" ? mode.defaults.customer : null}
          />
        </div>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Boxes</span>
          <input
            type="number"
            name="boxes"
            required
            min={1}
            step={1}
            inputMode="numeric"
            value={boxes || ""}
            onChange={(e) => setBoxes(Number(e.target.value))}
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">
            Unit price (GH₵)
          </span>
          <input
            type="text"
            name="unitPriceGhs"
            required
            inputMode="decimal"
            pattern="^\d+(\.\d{1,2})?$"
            value={unitPriceGhs}
            onChange={(e) => setUnitPriceGhs(e.target.value)}
            placeholder="50.00"
            className={inputClass}
          />
        </label>
      </div>

      <div className="rounded-lg bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
        <div className="flex items-baseline justify-between">
          <span className="text-slate-500">Current stock</span>
          <span className="font-medium">{quotedStock} boxes</span>
        </div>
        {previewTotalGhs ? (
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-slate-500">Total</span>
            <span className="font-medium">GH₵ {previewTotalGhs}</span>
          </div>
        ) : null}
        {exceedsStock ? (
          <p className="mt-2 text-rose-700">
            Requested boxes exceed current stock. Reduce the quantity.
          </p>
        ) : null}
      </div>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          Dispatch date
        </span>
        <input
          type="date"
          name="dispatchDate"
          required
          defaultValue={
            mode.kind === "edit" ? mode.defaults.dispatchDate : today
          }
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          Note <span className="text-slate-400">(optional)</span>
        </span>
        <textarea
          name="note"
          rows={3}
          defaultValue={mode.kind === "edit" ? mode.defaults.note ?? "" : ""}
          className={inputClass}
          placeholder="Anything the manager should know"
        />
      </label>

      {state && !state.ok ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending || exceedsStock || boxes <= 0}
          className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-base font-medium text-white shadow-sm hover:bg-slate-700 disabled:opacity-50"
        >
          {isPending
            ? "Submitting…"
            : mode.kind === "create"
              ? "Submit for approval"
              : "Resubmit"}
        </button>
        <Link
          href="/outbound"
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-base font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
