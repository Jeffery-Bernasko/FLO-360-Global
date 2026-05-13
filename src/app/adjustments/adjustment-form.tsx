"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  recordAdjustmentAction,
  type ActionResult,
} from "./actions";
import { ADJUSTMENT_REASONS } from "@/lib/adjustments-shared";

const inputClass =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900";

export function AdjustmentForm({ currentStock }: { currentStock: number }) {
  const [state, formAction, isPending] = useActionState<
    ActionResult<{ resultingStock: number }> | null,
    FormData
  >(recordAdjustmentAction, null);
  const router = useRouter();
  const [sign, setSign] = useState<"+" | "-">("-");
  const [magnitude, setMagnitude] = useState<number>(0);

  useEffect(() => {
    if (state?.ok) router.push("/adjustments");
  }, [state, router]);

  const resultingStock = sign === "-" ? currentStock - magnitude : currentStock + magnitude;
  const wouldGoNegative = resultingStock < 0;

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
    >
      <div className="rounded-lg bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
        <div className="flex items-baseline justify-between">
          <span className="text-slate-500">Current stock</span>
          <span className="font-medium">{currentStock} boxes</span>
        </div>
        {magnitude > 0 ? (
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-slate-500">After adjustment</span>
            <span
              className={`font-medium ${
                wouldGoNegative ? "text-rose-700" : "text-slate-900"
              }`}
            >
              {resultingStock} boxes
            </span>
          </div>
        ) : null}
      </div>

      <fieldset className="flex gap-2">
        <legend className="text-sm font-medium text-slate-700">
          Direction
        </legend>
        <label
          className={`flex-1 cursor-pointer rounded-lg border px-4 py-3 text-center text-base font-medium ${
            sign === "-"
              ? "border-rose-300 bg-rose-50 text-rose-800"
              : "border-slate-300 bg-white text-slate-700"
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
          className={`flex-1 cursor-pointer rounded-lg border px-4 py-3 text-center text-base font-medium ${
            sign === "+"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
              : "border-slate-300 bg-white text-slate-700"
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
      </fieldset>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Boxes</span>
        <input
          type="number"
          name="magnitude"
          required
          min={1}
          step={1}
          inputMode="numeric"
          value={magnitude || ""}
          onChange={(e) => setMagnitude(Number(e.target.value))}
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Reason</span>
        <select name="reason" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Pick a reason…
          </option>
          {ADJUSTMENT_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          Note <span className="text-slate-400">(optional)</span>
        </span>
        <textarea
          name="note"
          rows={3}
          className={inputClass}
          placeholder="Detail for the audit trail"
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
          disabled={isPending || magnitude <= 0 || wouldGoNegative}
          className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-base font-medium text-white shadow-sm hover:bg-slate-700 disabled:opacity-50"
        >
          {isPending ? "Recording…" : "Record adjustment"}
        </button>
        <Link
          href="/adjustments"
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-base font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
