"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
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
      <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs ring-1 ring-amber-200">
        <span className="text-amber-900">
          New temp password for <strong>{userName}</strong>:{" "}
          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[0.75rem]">
            {state.data.tempPassword}
          </code>
        </span>
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
        className="rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 focus-ring"
      >
        Reset password
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <span className="text-xs text-zinc-600">Reset {userName}&apos;s password?</span>
      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? "Resetting..." : "Confirm"}
      </Button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 focus-ring"
      >
        Cancel
      </button>
      {state && !state.ok ? (
        <span className="text-xs text-rose-600">{state.error}</span>
      ) : null}
    </form>
  );
}
