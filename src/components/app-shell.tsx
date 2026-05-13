import Link from "next/link";
import type { UserRole } from "@/db/schema";
import { signOutAction } from "./sign-out-action";
import { MobileNav } from "./mobile-nav";
import {
  IconHome,
  IconInbound,
  IconOutbound,
  IconInbox,
  IconCustomers,
  IconSuppliers,
  IconUsers,
  IconAdjustment,
  IconReports,
  IconSignOut,
  IconBox,
} from "./icons";

export type NavIconName =
  | "home"
  | "inbound"
  | "outbound"
  | "inbox"
  | "customers"
  | "suppliers"
  | "users"
  | "adjustment"
  | "reports";

export type NavItemData = {
  href: string;
  label: string;
  iconName: NavIconName;
};

const ICON_MAP: Record<NavIconName, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  home: IconHome,
  inbound: IconInbound,
  outbound: IconOutbound,
  inbox: IconInbox,
  customers: IconCustomers,
  suppliers: IconSuppliers,
  users: IconUsers,
  adjustment: IconAdjustment,
  reports: IconReports,
};

const WORKER_NAV: NavItemData[] = [
  { href: "/", label: "Dashboard", iconName: "home" },
  { href: "/inbound", label: "Inbound", iconName: "inbound" },
  { href: "/outbound", label: "Outbound", iconName: "outbound" },
];

const MANAGER_NAV: NavItemData[] = [
  { href: "/", label: "Dashboard", iconName: "home" },
  { href: "/approvals/inbound", label: "Inbox: Inbound", iconName: "inbox" },
  { href: "/approvals/outbound", label: "Inbox: Outbound", iconName: "inbox" },
  { href: "/inbound", label: "Inbound", iconName: "inbound" },
  { href: "/outbound", label: "Outbound", iconName: "outbound" },
  { href: "/customers", label: "Customers", iconName: "customers" },
  { href: "/suppliers", label: "Suppliers", iconName: "suppliers" },
  { href: "/users", label: "Users", iconName: "users" },
  { href: "/adjustments", label: "Adjustments", iconName: "adjustment" },
  { href: "/reports", label: "Reports", iconName: "reports" },
];

export function AppShell({
  user,
  children,
}: {
  user: { name: string; role: UserRole };
  children: React.ReactNode;
}) {
  const navItems = user.role === "manager" ? MANAGER_NAV : WORKER_NAV;

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Desktop sidebar — server-rendered */}
      <aside className="hidden lg:flex lg:w-[var(--sidebar-width)] lg:flex-col lg:fixed lg:inset-y-0 bg-sidebar border-r border-sidebar-border">
        <DesktopSidebar user={user} navItems={navItems} />
      </aside>

      {/* Mobile header + nav — client component, receives only serializable data */}
      <MobileNav user={user} navItems={navItems} />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0 lg:pl-[var(--sidebar-width)]">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 animate-in">
          {children}
        </div>
      </main>
    </div>
  );
}

function DesktopSidebar({
  user,
  navItems,
}: {
  user: { name: string; role: UserRole };
  navItems: NavItemData[];
}) {
  return (
    <>
      {/* Logo */}
      <div className="flex h-14 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600">
          <IconBox width={16} height={16} className="text-white" />
        </div>
        <span className="font-display text-base font-bold tracking-tight text-white">
          FLO 360
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = ICON_MAP[item.iconName];
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-sidebar-text transition-colors hover:bg-sidebar-hover hover:text-sidebar-active"
                >
                  <Icon width={18} height={18} className="flex-shrink-0 opacity-70" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User + sign out */}
      <div className="border-t border-sidebar-border px-3 py-3">
        <div className="mb-2 px-3">
          <p className="truncate text-sm font-medium text-sidebar-active">
            {user.name}
          </p>
          <p className="truncate text-xs capitalize text-sidebar-text">
            {user.role}
          </p>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-sidebar-text transition-colors hover:bg-sidebar-hover hover:text-rose-400"
          >
            <IconSignOut width={18} height={18} className="flex-shrink-0 opacity-70" />
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}
