import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/auth-server";
import { UnauthorizedError } from "@/auth-helpers";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/button";
import { DetailField, DetailGrid } from "@/components/ui/detail-field";
import { IconFile } from "@/components/icons";
import { formatGhs, formatGhsPlain } from "@/lib/money";
import { getCurrentStock } from "@/lib/stock-ledger";
import { getAttachmentUrl } from "@/lib/attachments";
import {
  formatInvoiceLabel,
  getOutboundForm,
} from "@/lib/outbound-forms";
import { OutboundFormFields } from "../outbound-form-fields";

type PageProps = { params: Promise<{ id: string }> };

export default async function OutboundDetailPage({ params }: PageProps) {
  let me: Awaited<ReturnType<typeof requireUser>>;
  try {
    me = await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in?from=/outbound");
    throw err;
  }

  const { id } = await params;
  const form = await getOutboundForm(BigInt(id));
  if (!form) notFound();

  if (me.role !== "manager" && form.createdBy !== me.id) {
    redirect("/outbound");
  }

  const isOwnerAndRejected =
    form.status === "rejected" && form.createdBy === me.id;

  const [currentStock, invoiceUrl] = await Promise.all([
    isOwnerAndRejected ? getCurrentStock() : Promise.resolve(0),
    form.invoicePdfKey ? getAttachmentUrl(form.invoicePdfKey) : null,
  ]);

  const totalPesewas = form.totalPesewas ?? form.boxes * form.unitPricePesewas;

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

          {form.status === "rejected" && form.decisionReason ? (
            <div className="mt-5">
              <Alert variant="error">
                <p className="font-medium">Rejected</p>
                <p className="mt-1">{form.decisionReason}</p>
              </Alert>
            </div>
          ) : null}
        </Card>

        {isOwnerAndRejected ? (
          <section className="mt-6">
            <h2 className="mb-3 font-display text-base font-semibold text-zinc-900">
              Edit and resubmit
            </h2>
            <OutboundFormFields
              mode={{
                kind: "edit",
                formId: String(form.id),
                currentStock,
                defaults: {
                  customer: {
                    id: form.customerId,
                    name: form.customerName,
                  },
                  boxes: form.boxes,
                  unitPriceGhs: formatGhsPlain(form.unitPricePesewas),
                  dispatchDate: form.dispatchDate,
                  note: form.note,
                },
              }}
            />
          </section>
        ) : (
          <div className="mt-6">
            <LinkButton href="/outbound" variant="secondary" size="lg" className="w-full">
              Back to list
            </LinkButton>
          </div>
        )}
      </div>
    </AppShell>
  );
}
