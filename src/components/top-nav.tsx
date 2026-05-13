import Link from "next/link";
import type { UserRole } from "@/db/schema";
import { signOut } from "@/auth";

type NavLink = { href: string; label: string };

const WORKER_LINKS: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/inbound", label: "Inbound" },
  { href: "/outbound", label: "Outbound" },
];

const MANAGER_LINKS: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/approvals/inbound", label: "Inbox: in" },
  { href: "/approvals/outbound", label: "Inbox: out" },
  { href: "/inbound", label: "Inbound" },
  { href: "/outbound", label: "Outbound" },
  { href: "/customers", label: "Customers" },
  { href: "/suppliers", label: "Suppliers" },
  { href: "/users", label: "Users" },
  { href: "/internal/ledger-debug", label: "Ledger" },
];

export function TopNav({
  user,
}: {
  user: { name: string; role: UserRole };
}) {
  const links = user.role === "manager" ? MANAGER_LINKS : WORKER_LINKS;

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-semibold">
            FLO 360
          </Link>
          <nav className="flex items-center gap-3">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/sign-in" });
          }}
        >
          <button
            type="submit"
            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            title={`Signed in as ${user.name}`}
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
