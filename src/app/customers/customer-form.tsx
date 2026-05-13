"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createCustomerAction,
  updateCustomerAction,
  type ActionResult,
} from "./actions";
import type { Customer } from "@/db/schema";

type Props = {
  /** When provided, the form is in "edit" mode and the action is update. */
  customer?: Customer;
  /** Where to navigate after a successful save. */
  successHref?: string;
};

const inputClass =
  "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900";

export function CustomerForm({ customer, successHref = "/customers" }: Props) {
  const isEdit = Boolean(customer);
  const action = isEdit ? updateCustomerAction : createCustomerAction;
  const [state, formAction, isPending] = useActionState<
    ActionResult<{ id: string }> | null,
    FormData
  >(action, null);

  const router = useRouter();

  useEffect(() => {
    if (state?.ok) router.push(successHref);
  }, [state, router, successHref]);

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
    >
      {customer ? (
        <input type="hidden" name="customerId" value={customer.id} />
      ) : null}

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Name</span>
        <input
          type="text"
          name="name"
          required
          defaultValue={customer?.name ?? ""}
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          Phone <span className="text-slate-400">(optional)</span>
        </span>
        <input
          type="tel"
          name="phone"
          defaultValue={customer?.phone ?? ""}
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          Location <span className="text-slate-400">(optional)</span>
        </span>
        <input
          type="text"
          name="location"
          defaultValue={customer?.location ?? ""}
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          Notes <span className="text-slate-400">(optional)</span>
        </span>
        <textarea
          name="notes"
          rows={3}
          defaultValue={customer?.notes ?? ""}
          className={inputClass}
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
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Create customer"}
        </button>
        <Link
          href="/customers"
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-base font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
