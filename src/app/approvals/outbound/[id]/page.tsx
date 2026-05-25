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
import { getStockForProduct } from "@/lib/stock-ledger";
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

  // Load per-product stock for the approval view.
  const productStockMap = new Map<string, number>();
  if (form.status === "pending") {
    await Promise.all(
      form.lines.map(async (line) => {
        if (!productStockMap.has(line.productId)) {
          const stock = await getStockForProduct(line.productId);
          productStockMap.set(line.productId, stock);
        }
      }),
    );
  }

  const invoiceUrl = form.invoicePdfKey
    ? await getAttachmentUrl(form.invoicePdfKey)
    : null;

  const insufficient = form.status === "pending" && form.lines.some(
    (l) => l.boxes > (productStockMap.get(l.productId) ?? 0),
  );

  return (
    <AppShell user={me}>
      <div className="mx-auto max-w-lg">
        <PageHeader
          title={`Outbound #${String(form.id)}`}
          description={form.customerName}
          actions={<StatusBadge status={form.status} />}
        />

        <Card>
          {/* Line items table with stock info */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-surface-border text-sm">
              <thead>
                <tr className="bg-zinc-50/60">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Product</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Boxes</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Unit price</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Subtotal</th>
                  {form.status === "pending" ? (
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Stock</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/60">
                {form.lines.map((line) => {
                  const stock = productStockMap.get(line.productId) ?? 0;
                  const low = form.status === "pending" && line.boxes > stock;
                  return (
                    <tr key={String(line.id)}>
                      <td className="px-3 py-2 font-medium text-zinc-900">{line.productName}</td>
                      <td className={`px-3 py-2 text-right font-mono ${low ? "text-rose-600 font-medium" : "text-zinc-700"}`}>
                        {line.boxes}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-700">{formatGhs(line.unitPricePesewas)}</td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-700">{formatGhs(line.boxes * line.unitPricePesewas)}</td>
                      {form.status === "pending" ? (
                        <td className={`px-3 py-2 text-right font-mono ${low ? "text-rose-600 font-medium" : "text-zinc-500"}`}>
                          {stock} avail
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
                <tr className="bg-zinc-50/60 font-semibold">
                  <td className="px-3 py-2 text-zinc-700">Total</td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-900">
                    {form.lines.reduce((s, l) => s + l.boxes, 0)}
                  </td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right font-mono text-zinc-900">
                    {formatGhs(form.totalPesewas)}
                  </td>
                  {form.status === "pending" ? <td className="px-3 py-2" /> : null}
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
