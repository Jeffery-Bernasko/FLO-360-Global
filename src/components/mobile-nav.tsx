"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import type { UserRole } from "@/db/schema";
import type { NavItemData, NavIconName } from "./app-shell";
import { signOutAction } from "./sign-out-action";
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
  IconMenu,
  IconClose,
} from "./icons";

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

export function MobileNav({
  user,
  navItems,
}: {
  user: { name: string; role: UserRole };
  navItems: NavItemData[];
}) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-surface-border bg-white px-4 lg:hidden">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo.jpeg"
            alt="FLO 360 Global"
            width={28}
            height={28}
            className="rounded-full"
          />
          <span className="font-display text-sm font-bold tracking-tight">FLO 360</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 focus-ring"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <IconClose /> : <IconMenu />}
        </button>
      </header>

      {/* Mobile overlay */}
      {open ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 fade-overlay lg:hidden"
            onClick={close}
            aria-hidden
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-[var(--sidebar-width)] flex-col bg-sidebar slide-in-left lg:hidden">
            {/* Logo */}
            <div className="flex h-14 items-center gap-3 border-b border-sidebar-border px-5">
              <Image
                src="/logo.jpeg"
                alt="FLO 360 Global"
                width={32}
                height={32}
                className="rounded-full"
              />
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
                        onClick={close}
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
          </aside>
        </>
      ) : null}
    </>
  );
}
