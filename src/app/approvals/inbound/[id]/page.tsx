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
import { getInboundForm } from "@/lib/inbound-forms";
import { getAttachmentUrl } from "@/lib/attachments";
import { getCurrentStock } from "@/lib/stock-ledger";
import { DecisionButtons } from "../decision-buttons";

type PageProps = { params: Promise<{ id: string }> };

export default async function ApproveInboundDetailPage({ params }: PageProps) {
  let me: Awaited<ReturnType<typeof requireManager>>;
  try {
    me = await requireManager();
  } catch (err) {
    if (err instanceof UnauthorizedError)
      redirect("/sign-in?from=/approvals/inbound");
    if (err instanceof ForbiddenError) redirect("/");
    throw err;
  }

  const { id } = await params;
  const form = await getInboundForm(BigInt(id));
  if (!form) notFound();

  const [attachmentUrl, currentStock] = await Promise.all([
    form.attachmentKey ? getAttachmentUrl(form.attachmentKey) : null,
    getCurrentStock(),
  ]);

  return (
    <AppShell user={me}>
      <div className="mx-auto max-w-lg">
        <PageHeader
          title={`Inbound #${String(form.id)}`}
          description={form.supplierName}
          actions={<StatusBadge status={form.status} />}
        />

        <Card>
          <DetailGrid>
            <DetailField label="Boxes" value={`${form.boxes}`} mono />
            <DetailField
              label="After approval"
              value={`${currentStock + form.boxes} boxes (currently ${currentStock})`}
            />
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
        </Card>

        {form.status === "pending" ? (
          <section className="mt-6">
            <DecisionButtons formId={String(form.id)} />
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
