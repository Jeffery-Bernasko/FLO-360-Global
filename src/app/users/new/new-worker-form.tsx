"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormCard } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { createWorkerAction, type ActionResult } from "../actions";

export function NewWorkerForm() {
  const [state, formAction, isPending] = useActionState<
    ActionResult<{ tempPassword: string; email: string }> | null,
    FormData
  >(createWorkerAction, null);

  if (state?.ok) {
    return (
      <Card>
        <div>
          <h2 className="font-display text-lg font-bold text-zinc-900">Worker created</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Share these credentials with{" "}
            <strong className="text-zinc-900">{state.data.email}</strong>{" "}
            out-of-band. The temp password is only shown here, once.
          </p>
        </div>

        <div className="mt-4 rounded-lg bg-amber-50 p-4 ring-1 ring-amber-200">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
            Temporary password
          </p>
          <code className="mt-2 block break-all rounded-lg bg-white px-3 py-2 font-mono text-sm text-zinc-900 ring-1 ring-amber-200">
            {state.data.tempPassword}
          </code>
        </div>

        <div className="mt-5">
          <LinkButton href="/users" size="lg" className="w-full">
            Done
          </LinkButton>
        </div>
      </Card>
    );
  }

  return (
    <form action={formAction}>
      <FormCard>
        <FormField label="Name">
          <Input
            type="text"
            name="name"
            required
            autoComplete="off"
          />
        </FormField>

        <FormField label="Email">
          <Input
            type="email"
            name="email"
            required
            autoComplete="off"
          />
        </FormField>

        {state && !state.ok ? <Alert>{state.error}</Alert> : null}

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={isPending} className="flex-1" size="lg">
            {isPending ? "Creating..." : "Create worker"}
          </Button>
          <Link
            href="/users"
            className="flex-1 inline-flex items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-medium text-zinc-700 shadow-sm ring-1 ring-surface-border transition-colors hover:bg-zinc-50"
          >
            Cancel
          </Link>
        </div>
      </FormCard>
    </form>
  );
}
