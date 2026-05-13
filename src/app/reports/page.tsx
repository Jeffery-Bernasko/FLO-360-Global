import Link from "next/link";
import { redirect } from "next/navigation";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { requireManager } from "@/auth-server";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { IconReports, IconCustomers, IconSuppliers } from "@/components/icons";

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
    <AppShell user={me}>
      <PageHeader
        title="Reports"
        description="Export stock movements, customer sales, and supplier deliveries for a date range."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <ReportCard
          href="/reports/movements"
          icon={<IconReports width={24} height={24} />}
          title="Stock Movement"
          description="Chronological ledger with running balance."
        />
        <ReportCard
          href="/reports/customers"
          icon={<IconCustomers width={24} height={24} />}
          title="Customers"
          description="Boxes and GHS totals by customer."
        />
        <ReportCard
          href="/reports/suppliers"
          icon={<IconSuppliers width={24} height={24} />}
          title="Suppliers"
          description="Received boxes by supplier."
        />
      </div>
    </AppShell>
  );
}

function ReportCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-surface-border transition-all hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="rounded-lg bg-zinc-100 p-2.5 text-zinc-500 transition-colors group-hover:bg-teal-50 group-hover:text-teal-700 w-fit">
        {icon}
      </div>
      <div>
        <p className="font-display text-base font-semibold text-zinc-900">{title}</p>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>
    </Link>
  );
}
