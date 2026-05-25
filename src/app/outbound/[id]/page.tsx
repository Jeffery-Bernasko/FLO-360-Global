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

  const invoiceUrl = form.invoicePdfKey
    ? await getAttachmentUrl(form.invoicePdfKey)
    : null;

  return (
    <AppShell user={me}>
      <div className="mx-auto max-w-lg">
        <PageHeader
          title={`Outbound #${String(form.id)}`}
          description={form.customerName}
          actions={<StatusBadge status={form.status} />}
        />

        <Card>
          {/* Line items table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-surface-border text-sm">
              <thead>
                <tr className="bg-zinc-50/60">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Product</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Boxes</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Unit price</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/60">
                {form.lines.map((line) => (
                  <tr key={String(line.id)}>
                    <td className="px-3 py-2 font-medium text-zinc-900">{line.productName}</td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-700">{line.boxes}</td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-700">{formatGhs(line.unitPricePesewas)}</td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-700">{formatGhs(line.boxes * line.unitPricePesewas)}</td>
                  </tr>
                ))}
                <tr className="bg-zinc-50/60 font-semibold">
                  <td className="px-3 py-2 text-zinc-700">Total</td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-900">
                    {form.lines.reduce((s, l) => s + l.boxes, 0)}
                  </td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right font-mono text-zinc-900">
                    {formatGhs(form.totalPesewas)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <DetailGrid>
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
                defaults: {
                  customer: {
                    id: form.customerId,
                    name: form.customerName,
                  },
                  lines: form.lines.map((l) => ({
                    product: { id: l.productId, name: l.productName },
                    boxes: l.boxes,
                    unitPriceGhs: formatGhsPlain(l.unitPricePesewas),
                  })),
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
