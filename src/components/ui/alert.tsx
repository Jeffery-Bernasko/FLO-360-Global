type AlertVariant = "error" | "warning" | "success" | "info";

const styles: Record<AlertVariant, string> = {
  error: "bg-rose-50 text-rose-800 ring-rose-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
};

export function Alert({
  variant = "error",
  children,
  className,
}: {
  variant?: AlertVariant;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={[
        "rounded-lg px-4 py-3 text-sm ring-1",
        styles[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
