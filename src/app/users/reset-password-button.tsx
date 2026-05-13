"use client";

import { useActionState, useState } from "react";
import { resetUserPasswordAction, type ActionResult } from "./actions";

export function ResetPasswordButton({
  userId,
  userName,
}: {
  userId: string;
  userName: string;
}) {
  const [state, formAction, isPending] = useActionState<
    ActionResult<{ userId: string; tempPassword: string }> | null,
    FormData
  >(resetUserPasswordAction, null);
  const [confirming, setConfirming] = useState(false);

  if (state?.ok && state.data.userId === userId) {
    return (
      <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
        New temp password for <strong>{userName}</strong>:{" "}
        <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[0.75rem]">
          {state.data.tempPassword}
        </code>
        <div className="mt-1 text-[0.7rem] text-amber-700">
          Share with the worker out-of-band. This is the only time it is shown.
        </div>
      </div>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
      >
        Reset password
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <span className="text-xs text-slate-600">Reset {userName}&apos;s password?</span>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {isPending ? "Resetting…" : "Confirm"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
      >
        Cancel
      </button>
      {state && !state.ok ? (
        <span className="text-xs text-rose-600">{state.error}</span>
      ) : null}
    </form>
  );
}
