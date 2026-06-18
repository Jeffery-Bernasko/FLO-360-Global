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
import { getInboundForm } from "@/lib/inbound-forms";
import { getAttachmentUrl } from "@/lib/attachments";
import { InboundFormFields } from "../inbound-form-fields";

type PageProps = { params: Promise<{ id: string }> };

export default async function InboundDetailPage({ params }: PageProps) {
  let me: Awaited<ReturnType<typeof requireUser>>;
  try {
    me = await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in?from=/inbound");
    throw err;
  }

  const { id } = await params;
  const form = await getInboundForm(BigInt(id));
  if (!form) notFound();

  if (me.role !== "manager" && form.createdBy !== me.id) {
    redirect("/inbound");
  }

  const attachmentUrl = form.attachmentKey
    ? await getAttachmentUrl(form.attachmentKey)
    : null;

  const isOwnerAndRejected =
    form.status === "rejected" && form.createdBy === me.id;

  return (
    <AppShell user={me}>
      <div className="mx-auto max-w-lg">
        <PageHeader
          title={`Inbound #${String(form.id)}`}
          description={form.supplierName}
          actions={<StatusBadge status={form.status} />}
        />

        <Card>
          {/* Line items table */}
          {form.lines.length > 0 ? (
            <div className="mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Products</h3>
              <div className="overflow-x-auto rounded-lg ring-1 ring-surface-border">
                <table className="min-w-full divide-y divide-surface-border text-sm">
                  <thead>
                    <tr className="bg-zinc-50/60">
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Product</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Boxes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border/60">
                    {form.lines.map((line) => (
                      <tr key={String(line.id)}>
                        <td className="px-3 py-2 text-zinc-900">{line.productName}</td>
                        <td className="px-3 py-2 text-right font-mono text-zinc-700">{line.boxes}</td>
                      </tr>
                    ))}
                    <tr className="bg-zinc-50/40">
                      <td className="px-3 py-2 text-xs font-semibold uppercase text-zinc-500">Total</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-zinc-900">{form.boxes}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <DetailGrid>
              <DetailField label="Boxes" value={`${form.boxes}`} mono />
            </DetailGrid>
          )}

          <DetailGrid>
            <DetailField label="Date received" value={form.receivedDate} />
            {form.note ? <DetailField label="Note" value={form.note} /> : null}
          </DetailGrid>

          {attachmentUrl ? (
            <div className="mt-5 pt-5 border-t border-surface-border">
              <a
                href={attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 ring-1 ring-surface-border transition-colors hover:bg-zinc-100"
              >
                <IconFile width={16} height={16} />
                Open photo / PDF
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
            <InboundFormFields
              mode={{
                kind: "edit",
                formId: String(form.id),
                defaults: {
                  supplier: {
                    id: form.supplierId,
                    name: form.supplierName,
                  },
                  lines: form.lines.map((l) => ({
                    product: { id: l.productId, name: l.productName },
                    boxes: l.boxes,
                  })),
                  receivedDate: form.receivedDate,
                  note: form.note,
                },
              }}
            />
          </section>
        ) : (
          <div className="mt-6">
            <LinkButton href="/inbound" variant="secondary" size="lg" className="w-full">
              Back to list
            </LinkButton>
          </div>
        )}
      </div>
    </AppShell>
  );
}
