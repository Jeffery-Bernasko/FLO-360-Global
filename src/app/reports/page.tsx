import Link from "next/link";
import { redirect } from "next/navigation";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { requireManager } from "@/auth-server";
import { TopNav } from "@/components/top-nav";
import { ReportsHeader } from "./report-ui";

export default async function ReportsPage() {
  let me: Awaited<ReturnType<typeof requireManager>>;
  try {
    me = await requireManager();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in?from=/reports");
    if (err instanceof ForbiddenError) redirect("/");
    throw err;
  }

  return (
    <>
      <TopNav user={me} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <ReportsHeader
          title="Reports"
          description="Export stock movements, customer sales, and supplier deliveries for a date range."
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <ReportCard
            href="/reports/movements"
            title="Stock movement"
            description="Chronological ledger with running balance."
          />
          <ReportCard
            href="/reports/customers"
            title="Customers"
            description="Boxes and GHS totals by customer."
          />
          <ReportCard
            href="/reports/suppliers"
            title="Suppliers"
            description="Received boxes by supplier."
          />
        </div>
      </main>
    </>
  );
}

function ReportCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
    >
      <p className="font-medium text-slate-950">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </Link>
  );
}
