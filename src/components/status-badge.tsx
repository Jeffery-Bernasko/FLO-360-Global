import type { FormStatus } from "@/db/schema";
import { Badge } from "./ui/badge";

const VARIANT: Record<FormStatus, "pending" | "approved" | "rejected"> = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
};

const LABELS: Record<FormStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export function StatusBadge({ status }: { status: FormStatus }) {
  return <Badge variant={VARIANT[status]}>{LABELS[status]}</Badge>;
}
