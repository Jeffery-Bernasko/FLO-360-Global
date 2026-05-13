import Link from "next/link";
import { requireManager } from "@/auth-server";
import { TopNav } from "@/components/top-nav";
import { listUsers } from "@/lib/users";
import {
  deactivateUserAction,
  reactivateUserAction,
} from "./actions";
import { ResetPasswordButton } from "./reset-password-button";

export default async function UsersPage() {
  const me = await requireManager();
  const all = await listUsers(me);

  const active = all.filter((u) => u.isActive);
  const inactive = all.filter((u) => !u.isActive);

  return (
    <>
      <TopNav user={me} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Users</h1>
            <p className="text-sm text-slate-500">
              Workers and managers who can sign in.
            </p>
          </div>
          <Link
            href="/users/new"
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-700"
          >
            Add worker
          </Link>
        </div>

        <Section title="Active" empty="No active users yet.">
          {active.map((u) => (
            <UserRow key={u.id} user={u} currentUserId={me.id} />
          ))}
        </Section>

        {inactive.length > 0 && (
          <div className="mt-8">
            <Section title="Inactive" empty="">
              {inactive.map((u) => (
                <UserRow key={u.id} user={u} currentUserId={me.id} />
              ))}
            </Section>
          </div>
        )}
      </main>
    </>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  const isEmpty = items.filter(Boolean).length === 0;

  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        {isEmpty ? (
          <p className="p-4 text-sm text-slate-500">{empty}</p>
        ) : (
          <ul className="divide-y divide-slate-200">{children}</ul>
        )}
      </div>
    </section>
  );
}

type UserRowProps = {
  user: {
    id: string;
    email: string;
    name: string;
    role: "worker" | "manager";
    isActive: boolean;
  };
  currentUserId: string;
};

function UserRow({ user, currentUserId }: UserRowProps) {
  const isMe = user.id === currentUserId;

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium">{user.name}</p>
          <Badge color={user.role === "manager" ? "indigo" : "slate"}>
            {user.role === "manager" ? "Manager" : "Worker"}
          </Badge>
          {!user.isActive && <Badge color="rose">Inactive</Badge>}
          {isMe && <Badge color="emerald">You</Badge>}
        </div>
        <p className="truncate text-sm text-slate-500">{user.email}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {user.isActive ? (
          <>
            <ResetPasswordButton userId={user.id} userName={user.name} />
            {!isMe && (
              <form action={deactivateUserAction}>
                <input type="hidden" name="userId" value={user.id} />
                <button
                  type="submit"
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                >
                  Deactivate
                </button>
              </form>
            )}
          </>
        ) : (
          <form action={reactivateUserAction}>
            <input type="hidden" name="userId" value={user.id} />
            <button
              type="submit"
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
            >
              Reactivate
            </button>
          </form>
        )}
      </div>
    </li>
  );
}

function Badge({
  children,
  color,
}: {
  children: React.ReactNode;
  color: "slate" | "indigo" | "rose" | "emerald";
}) {
  const styles = {
    slate: "bg-slate-100 text-slate-700",
    indigo: "bg-indigo-50 text-indigo-700",
    rose: "bg-rose-50 text-rose-700",
    emerald: "bg-emerald-50 text-emerald-700",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[color]}`}
    >
      {children}
    </span>
  );
}
