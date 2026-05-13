import { forbidden, unauthorized } from "next/navigation";
import { requireManager } from "@/auth-server";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listUsers } from "@/lib/users";
import {
  deactivateUserAction,
  reactivateUserAction,
} from "./actions";
import { ResetPasswordButton } from "./reset-password-button";

export default async function UsersPage() {
  let me: Awaited<ReturnType<typeof requireManager>>;
  try {
    me = await requireManager();
  } catch (err) {
    if (err instanceof UnauthorizedError) unauthorized();
    if (err instanceof ForbiddenError) forbidden();
    throw err;
  }
  const all = await listUsers(me);

  const active = all.filter((u) => u.isActive);
  const inactive = all.filter((u) => !u.isActive);

  return (
    <AppShell user={me}>
      <PageHeader
        title="Users"
        description="Workers and managers who can sign in."
        actions={<LinkButton href="/users/new">Add worker</LinkButton>}
      />

      <div className="space-y-6">
        <UserTable title="Active" users={active} currentUserId={me.id} emptyMessage="No active users." />
        {inactive.length > 0 && (
          <UserTable title="Inactive" users={inactive} currentUserId={me.id} emptyMessage="" />
        )}
      </div>
    </AppShell>
  );
}

type UserItem = {
  id: string;
  email: string;
  name: string;
  role: "worker" | "manager";
  isActive: boolean;
};

function UserTable({
  title,
  users,
  currentUserId,
  emptyMessage,
}: {
  title: string;
  users: UserItem[];
  currentUserId: string;
  emptyMessage: string;
}) {
  if (users.length === 0 && emptyMessage) {
    return (
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
        <div className="rounded-xl bg-white px-6 py-8 text-center text-sm text-zinc-500 ring-1 ring-surface-border">
          {emptyMessage}
        </div>
      </section>
    );
  }
  if (users.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
      <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-surface-border">
        <table className="min-w-full divide-y divide-surface-border text-sm">
          <thead>
            <tr className="bg-zinc-50/60">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Role</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border/60">
            {users.map((u) => {
              const isMe = u.id === currentUserId;
              return (
                <tr key={u.id} className="transition-colors hover:bg-zinc-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900">{u.name}</span>
                      {!u.isActive && <Badge variant="danger">Inactive</Badge>}
                      {isMe && <Badge variant="success">You</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={u.role === "manager" ? "manager" : "worker"}>
                      {u.role === "manager" ? "Manager" : "Worker"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {u.isActive ? (
                        <>
                          <ResetPasswordButton userId={u.id} userName={u.name} />
                          {!isMe && (
                            <form action={deactivateUserAction}>
                              <input type="hidden" name="userId" value={u.id} />
                              <button
                                type="submit"
                                className="rounded-md px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 focus-ring transition-colors"
                              >
                                Deactivate
                              </button>
                            </form>
                          )}
                        </>
                      ) : (
                        <form action={reactivateUserAction}>
                          <input type="hidden" name="userId" value={u.id} />
                          <button
                            type="submit"
                            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 focus-ring transition-colors"
                          >
                            Reactivate
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
