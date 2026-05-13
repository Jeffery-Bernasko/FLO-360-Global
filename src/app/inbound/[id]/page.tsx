import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/auth-server";
import { UnauthorizedError } from "@/auth-helpers";
import { TopNav } from "@/components/top-nav";
import { StatusBadge } from "@/components/status-badge";
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

  // Workers can only see their own forms; managers see all (they have the
  // approval inbox at /approvals/inbound, but landing here is fine too).
  if (me.role !== "manager" && form.createdBy !== me.id) {
    redirect("/inbound");
  }

  const attachmentUrl = form.attachmentKey
    ? await getAttachmentUrl(form.attachmentKey)
    : null;

  const isOwnerAndRejected =
    form.status === "rejected" && form.createdBy === me.id;

  return (
    <>
      <TopNav user={me} />
      <main className="mx-auto max-w-md px-4 py-6">
        <header className="mb-6">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">
              Inbound #{String(form.id)}
            </h1>
            <StatusBadge status={form.status} />
          </div>
          <p className="text-sm text-slate-500">{form.supplierName}</p>
        </header>

        <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <Field label="Boxes" value={`${form.boxes}`} />
          <Field label="Date received" value={form.receivedDate} />
          {form.note ? <Field label="Note" value={form.note} /> : null}
          {attachmentUrl ? (
            <div>
              <p className="text-sm font-medium text-slate-500">Attachment</p>
              <a
                href={attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Open photo / PDF
              </a>
            </div>
          ) : null}
          {form.status === "rejected" && form.decisionReason ? (
            <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-200">
              <p className="font-medium">Rejected</p>
              <p className="mt-1">{form.decisionReason}</p>
            </div>
          ) : null}
        </section>

        {isOwnerAndRejected ? (
          <section className="mt-6">
            <h2 className="mb-2 text-sm font-semibold">Edit and resubmit</h2>
            <InboundFormFields
              mode={{
                kind: "edit",
                formId: String(form.id),
                defaults: {
                  supplier: {
                    id: form.supplierId,
                    name: form.supplierName,
                  },
                  boxes: form.boxes,
                  receivedDate: form.receivedDate,
                  note: form.note,
                },
              }}
            />
          </section>
        ) : (
          <div className="mt-6 flex">
            <Link
              href="/inbound"
              className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-base font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to list
            </Link>
          </div>
        )}
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
