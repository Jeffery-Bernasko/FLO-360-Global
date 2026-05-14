import { notFound, redirect } from "next/navigation";
import { requireManager } from "@/auth-server";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/button";
import { DetailField, DetailGrid } from "@/components/ui/detail-field";
import { IconFile } from "@/components/icons";
import { getOutboundForm, formatInvoiceLabel } from "@/lib/outbound-forms";
import { getAttachmentUrl } from "@/lib/attachments";
import { getCurrentStock } from "@/lib/stock-ledger";
import { formatGhs } from "@/lib/money";
import { OutboundDecisionButtons } from "../decision-buttons";

type PageProps = { params: Promise<{ id: string }> };

export default async function ApproveOutboundDetailPage({ params }: PageProps) {
  let me: Awaited<ReturnType<typeof requireManager>>;
  try {
    me = await requireManager();
  } catch (err) {
    if (err instanceof UnauthorizedError)
      redirect("/sign-in?from=/approvals/outbound");
    if (err instanceof ForbiddenError) redirect("/");
    throw err;
  }

  const { id } = await params;
  const form = await getOutboundForm(BigInt(id));
  if (!form) notFound();

  const [invoiceUrl, currentStock] = await Promise.all([
    form.invoicePdfKey ? getAttachmentUrl(form.invoicePdfKey) : null,
    getCurrentStock(),
  ]);

  const totalPesewas = form.totalPesewas ?? form.boxes * form.unitPricePesewas;
  const insufficient = form.status === "pending" && form.boxes > currentStock;

  return (
    <AppShell user={me}>
      <div className="mx-auto max-w-lg">
        <PageHeader
          title={`Outbound #${String(form.id)}`}
          description={form.customerName}
          actions={<StatusBadge status={form.status} />}
        />

        <Card>
          <DetailGrid>
            <DetailField label="Boxes" value={`${form.boxes}`} mono />
            <DetailField label="Unit price" value={formatGhs(form.unitPricePesewas)} mono />
            <DetailField label="Total" value={formatGhs(totalPesewas)} mono />
            <DetailField label="Dispatch date" value={form.dispatchDate} />
            {form.note ? <DetailField label="Note" value={form.note} /> : null}
            {form.status === "pending" ? (
              <DetailField
                label="After approval"
                value={`${currentStock - form.boxes} boxes (currently ${currentStock})`}
              />
            ) : null}
            {form.status === "approved" && form.invoiceNumber ? (
              <DetailField
                label="Invoice"
                value={formatInvoiceLabel(
                  form.invoiceNumber,
                  form.decidedAt
                    ? new Date(form.decidedAt).getFullYear()
                    : new Date().getFullYear(),
                )}
              />
            ) : null}
          </DetailGrid>

          {invoiceUrl ? (
            <div className="mt-5 pt-5 border-t border-surface-border">
              <a
                href={invoiceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 ring-1 ring-surface-border transition-colors hover:bg-zinc-100"
              >
                <IconFile width={16} height={16} />
                Open invoice
              </a>
            </div>
          ) : null}
        </Card>

        {form.status === "pending" ? (
          <section className="mt-6">
            <OutboundDecisionButtons
              formId={String(form.id)}
              insufficientStock={insufficient}
            />
          </section>
        ) : (
          <Alert variant="info" className="mt-6">
            This form has already been {form.status}
            {form.decisionReason ? ` ("${form.decisionReason}")` : ""}.
          </Alert>
        )}

        <div className="mt-6">
          <LinkButton href="/approvals" variant="secondary" size="lg" className="w-full">
            Back to inbox
          </LinkButton>
        </div>
      </div>
    </AppShell>
  );
}
