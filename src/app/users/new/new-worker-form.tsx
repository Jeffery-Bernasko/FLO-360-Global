"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createWorkerAction, type ActionResult } from "../actions";

export function NewWorkerForm() {
  const [state, formAction, isPending] = useActionState<
    ActionResult<{ tempPassword: string; email: string }> | null,
    FormData
  >(createWorkerAction, null);

  if (state?.ok) {
    return (
      <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div>
          <h2 className="text-lg font-semibold">Worker created</h2>
          <p className="mt-1 text-sm text-slate-500">
            Share these credentials with{" "}
            <strong className="text-slate-900">{state.data.email}</strong>{" "}
            out-of-band. The temp password is only shown here, once.
          </p>
        </div>

        <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
            Temporary password
          </p>
          <code className="mt-1 block break-all rounded-lg bg-white px-3 py-2 font-mono text-base text-slate-900 ring-1 ring-amber-200">
            {state.data.tempPassword}
          </code>
        </div>

        <div className="flex gap-2">
          <Link
            href="/users"
            className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-slate-700"
          >
            Done
          </Link>
        </div>
      </section>
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
    >
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Name</span>
        <input
          type="text"
          name="name"
          required
          autoComplete="off"
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="off"
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
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
          disabled={isPending}
          className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-base font-medium text-white shadow-sm hover:bg-slate-700 disabled:opacity-50"
        >
          {isPending ? "Creating…" : "Create worker"}
        </button>
        <Link
          href="/users"
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-base font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
