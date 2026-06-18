type BadgeVariant =
  | "default"
  | "pending"
  | "approved"
  | "rejected"
  | "info"
  | "danger"
  | "success"
  | "manager"
  | "worker";

const styles: Record<BadgeVariant, string> = {
  default: "bg-zinc-100 text-zinc-700",
  pending: "bg-amber-50 text-amber-800 ring-1 ring-amber-300/50",
  approved: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-300/50",
  rejected: "bg-rose-50 text-rose-800 ring-1 ring-rose-300/50",
  info: "bg-sky-50 text-sky-800 ring-1 ring-sky-300/50",
  danger: "bg-rose-50 text-rose-700",
  success: "bg-emerald-50 text-emerald-700",
  manager: "bg-violet-50 text-violet-700 ring-1 ring-violet-300/50",
  worker: "bg-zinc-100 text-zinc-600",
};

export function Badge({
  variant = "default",
  children,
  className,
}: {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        styles[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
