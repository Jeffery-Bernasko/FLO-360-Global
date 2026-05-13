"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { PartyPicker } from "@/components/party-picker";
import {
  submitInboundAction,
  editAndResubmitInboundAction,
  type ActionResult,
} from "./actions";

const inputClass =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900";

type Mode =
  | { kind: "create" }
  | {
      kind: "edit";
      formId: string;
      defaults: {
        supplier: { id: string; name: string };
        boxes: number;
        receivedDate: string;
        note: string | null;
      };
    };

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
      router.push(
        mode.kind === "create" ? `/inbound/${state.data.id}` : `/inbound/${state.data.id}`,
      );
    }
  }, [state, router, mode.kind]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
    >
      {mode.kind === "edit" && (
        <input type="hidden" name="formId" value={mode.formId} />
      )}

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Supplier</span>
        <div className="mt-1">
          <PartyPicker
            kind="supplier"
            required
            initial={mode.kind === "edit" ? mode.defaults.supplier : null}
          />
        </div>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Boxes</span>
        <input
          type="number"
          name="boxes"
          required
          min={1}
          step={1}
          inputMode="numeric"
          defaultValue={mode.kind === "edit" ? String(mode.defaults.boxes) : ""}
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          Date received
        </span>
        <input
          type="date"
          name="receivedDate"
          required
          defaultValue={
            mode.kind === "edit" ? mode.defaults.receivedDate : today
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

      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          Photo of waybill / invoice{" "}
          <span className="text-slate-400">(optional)</span>
        </span>
        <input
          type="file"
          name="attachment"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
        />
        {mode.kind === "edit" ? (
          <p className="mt-1 text-xs text-slate-500">
            Pick a new file to replace the existing photo, or leave empty to
            keep it.
          </p>
        ) : null}
      </label>

      {state && !state.ok ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-base font-medium text-white shadow-sm hover:bg-slate-700 disabled:opacity-50"
        >
          {isPending
            ? "Submitting…"
            : mode.kind === "create"
              ? "Submit for approval"
              : "Resubmit"}
        </button>
        <Link
          href="/inbound"
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-base font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
