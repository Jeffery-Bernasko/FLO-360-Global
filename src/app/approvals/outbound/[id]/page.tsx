import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireManager } from "@/auth-server";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { TopNav } from "@/components/top-nav";
import { StatusBadge } from "@/components/status-badge";
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
    <>
      <TopNav user={me} />
      <main className="mx-auto max-w-md px-4 py-6">
        <header className="mb-6">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">
              Outbound #{String(form.id)}
            </h1>
            <StatusBadge status={form.status} />
          </div>
          <p className="text-sm text-slate-500">{form.customerName}</p>
        </header>

        <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <Field label="Boxes" value={`${form.boxes}`} />
          <Field label="Unit price" value={formatGhs(form.unitPricePesewas)} />
          <Field label="Total" value={formatGhs(totalPesewas)} />
          <Field label="Dispatch date" value={form.dispatchDate} />
          {form.note ? <Field label="Note" value={form.note} /> : null}
          {form.status === "pending" ? (
            <Field
              label="After approval, stock would be"
              value={`${currentStock - form.boxes} boxes (currently ${currentStock})`}
            />
          ) : null}
          {form.status === "approved" && form.invoiceNumber ? (
            <Field
              label="Invoice"
              value={formatInvoiceLabel(
                form.invoiceNumber,
                form.decidedAt
                  ? new Date(form.decidedAt).getFullYear()
                  : new Date().getFullYear(),
              )}
            />
          ) : null}
          {invoiceUrl ? (
            <div>
              <p className="text-sm font-medium text-slate-500">Invoice PDF</p>
              <a
                href={invoiceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Open invoice
              </a>
            </div>
          ) : null}
        </section>

        {form.status === "pending" ? (
          <section className="mt-6">
            <OutboundDecisionButtons
              formId={String(form.id)}
              insufficientStock={insufficient}
            />
          </section>
        ) : (
          <section className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-slate-200">
            This form has already been {form.status}
            {form.decisionReason ? ` ("${form.decisionReason}")` : ""}.
          </section>
        )}

        <div className="mt-6 flex">
          <Link
            href="/approvals/outbound"
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-base font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to inbox
          </Link>
        </div>
      </main>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-base text-slate-900">{value}</p>
    </div>
  );
}
