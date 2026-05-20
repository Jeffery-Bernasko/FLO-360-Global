"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormCard, FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  changePasswordAction,
  type ChangePasswordActionResult,
} from "./actions";

export function ChangePasswordForm({ from }: { from: string }) {
  const [state, formAction, isPending] = useActionState<
    ChangePasswordActionResult | null,
    FormData
  >(changePasswordAction, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="from" value={from} />
      <FormCard>
        <FormField
          label="New password"
          hint="Use at least 8 characters. Must be different from your current password."
        >
          <Input
            type="password"
            name="newPassword"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </FormField>

        <FormField label="Confirm password">
          <Input
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </FormField>

        {state && !state.ok ? <Alert>{state.error}</Alert> : null}

        <Button type="submit" disabled={isPending} size="lg" className="w-full">
          {isPending ? "Saving..." : "Save password"}
        </Button>
      </FormCard>
    </form>
  );
}
