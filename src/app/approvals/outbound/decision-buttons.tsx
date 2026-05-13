"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";
import {
  approveOutboundAction,
  rejectOutboundAction,
  type ActionResult,
} from "./actions";

export function OutboundDecisionButtons({
  formId,
  insufficientStock,
}: {
  formId: string;
  insufficientStock: boolean;
}) {
  const router = useRouter();
  const [showReject, setShowReject] = useState(false);

  const [approveState, approveAction, isApproving] = useActionState<
    ActionResult<{ id: string }> | null,
    FormData
  >(approveOutboundAction, null);

  const [rejectState, rejectAction, isRejecting] = useActionState<
    ActionResult<{ id: string }> | null,
    FormData
  >(rejectOutboundAction, null);

  if (approveState?.ok || rejectState?.ok) {
    setTimeout(() => router.push("/approvals/outbound"), 0);
  }

  return (
    <div className="space-y-3">
      {!showReject ? (
        <>
          <form action={approveAction}>
            <input type="hidden" name="formId" value={formId} />
            <Button
              type="submit"
              disabled={isApproving || insufficientStock}
              variant="approve"
              size="lg"
              className="w-full"
            >
              {isApproving
                ? "Approving..."
                : insufficientStock
                  ? "Insufficient stock"
                  : "Approve"}
            </Button>
          </form>
          <Button
            type="button"
            onClick={() => setShowReject(true)}
            variant="reject"
            size="lg"
            className="w-full"
          >
            Reject...
          </Button>
          {approveState && !approveState.ok ? (
            <Alert>{approveState.error}</Alert>
          ) : null}
        </>
      ) : (
        <form action={rejectAction} className="space-y-3">
          <input type="hidden" name="formId" value={formId} />
          <FormField label="Rejection reason">
            <Textarea
              name="reason"
              required
              rows={3}
              placeholder="Why is this being rejected?"
            />
          </FormField>
          {rejectState && !rejectState.ok ? (
            <Alert>{rejectState.error}</Alert>
          ) : null}
          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={isRejecting}
              variant="danger"
              size="lg"
              className="flex-1"
            >
              {isRejecting ? "Rejecting..." : "Confirm reject"}
            </Button>
            <Button
              type="button"
              onClick={() => setShowReject(false)}
              variant="secondary"
              size="lg"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
