"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  approveInboundAction,
  rejectInboundAction,
  type ActionResult,
} from "./actions";

export function DecisionButtons({ formId }: { formId: string }) {
  const router = useRouter();
  const [showReject, setShowReject] = useState(false);

  const [approveState, approveAction, isApproving] = useActionState<
    ActionResult<{ id: string }> | null,
    FormData
  >(approveInboundAction, null);

  const [rejectState, rejectAction, isRejecting] = useActionState<
    ActionResult<{ id: string }> | null,
    FormData
  >(rejectInboundAction, null);

  if (approveState?.ok || rejectState?.ok) {
    setTimeout(() => router.push("/approvals/inbound"), 0);
  }

  return (
    <div className="space-y-3">
      {!showReject ? (
        <>
          <form action={approveAction}>
            <input type="hidden" name="formId" value={formId} />
            <button
              type="submit"
              disabled={isApproving}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-base font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {isApproving ? "Approving…" : "Approve"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setShowReject(true)}
            className="w-full rounded-xl border border-rose-300 bg-white px-4 py-3 text-base font-medium text-rose-700 hover:bg-rose-50"
          >
            Reject…
          </button>
          {approveState && !approveState.ok ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
              {approveState.error}
            </p>
          ) : null}
        </>
      ) : (
        <form action={rejectAction} className="space-y-3">
          <input type="hidden" name="formId" value={formId} />
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Rejection reason
            </span>
            <textarea
              name="reason"
              required
              rows={3}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              placeholder="Why is this being rejected?"
            />
          </label>
          {rejectState && !rejectState.ok ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
              {rejectState.error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isRejecting}
              className="flex-1 rounded-xl bg-rose-600 px-4 py-3 text-base font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {isRejecting ? "Rejecting…" : "Confirm reject"}
            </button>
            <button
              type="button"
              onClick={() => setShowReject(false)}
              className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
