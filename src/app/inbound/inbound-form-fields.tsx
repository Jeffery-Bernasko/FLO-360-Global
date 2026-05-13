"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { PartyPicker } from "@/components/party-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormCard } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";
import {
  submitInboundAction,
  editAndResubmitInboundAction,
  type ActionResult,
} from "./actions";

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
      router.push(`/inbound/${state.data.id}`);
    }
  }, [state, router]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} encType="multipart/form-data">
      <FormCard>
        {mode.kind === "edit" && (
          <input type="hidden" name="formId" value={mode.formId} />
        )}

        <FormField label="Supplier">
          <PartyPicker
            kind="supplier"
            required
            initial={mode.kind === "edit" ? mode.defaults.supplier : null}
          />
        </FormField>

        <FormField label="Boxes">
          <Input
            type="number"
            name="boxes"
            required
            min={1}
            step={1}
            inputMode="numeric"
            defaultValue={mode.kind === "edit" ? String(mode.defaults.boxes) : ""}
          />
        </FormField>

        <FormField label="Date received">
          <Input
            type="date"
            name="receivedDate"
            required
            defaultValue={mode.kind === "edit" ? mode.defaults.receivedDate : today}
          />
        </FormField>

        <FormField label="Note" optional>
          <Textarea
            name="note"
            rows={3}
            defaultValue={mode.kind === "edit" ? mode.defaults.note ?? "" : ""}
            placeholder="Anything the manager should know"
          />
        </FormField>

        <FormField
          label="Photo of waybill / invoice"
          optional
          hint={mode.kind === "edit" ? "Pick a new file to replace, or leave empty to keep it." : undefined}
        >
          <input
            type="file"
            name="attachment"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 file:transition-colors file:cursor-pointer"
          />
        </FormField>

        {state && !state.ok ? <Alert>{state.error}</Alert> : null}

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={isPending} className="flex-1" size="lg">
            {isPending
              ? "Submitting..."
              : mode.kind === "create"
                ? "Submit for approval"
                : "Resubmit"}
          </Button>
          <Link
            href="/inbound"
            className="flex-1 inline-flex items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-medium text-zinc-700 shadow-sm ring-1 ring-surface-border transition-colors hover:bg-zinc-50"
          >
            Cancel
          </Link>
        </div>
      </FormCard>
    </form>
  );
}
