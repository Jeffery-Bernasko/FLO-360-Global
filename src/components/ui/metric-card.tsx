import Link from "next/link";

type MetricCardProps = {
  label: string;
  value: string | number;
  unit?: string;
  href?: string;
  variant?: "default" | "warning" | "danger" | "success";
  subtitle?: string;
  icon?: React.ReactNode;
};

const variantStyles = {
  default: {
    card: "ring-surface-border",
    value: "text-zinc-900",
    label: "text-zinc-500",
  },
  warning: {
    card: "ring-amber-200 bg-amber-50/50",
    value: "text-amber-900",
    label: "text-amber-700",
  },
  danger: {
    card: "ring-rose-200 bg-rose-50/50",
    value: "text-rose-700",
    label: "text-rose-600",
  },
  success: {
    card: "ring-emerald-200 bg-emerald-50/50",
    value: "text-emerald-800",
    label: "text-emerald-700",
  },
};

export function MetricCard({
  label,
  value,
  unit,
  href,
  variant = "default",
  subtitle,
  icon,
}: MetricCardProps) {
  const s = variantStyles[variant];
  const content = (
    <div
      className={[
        "rounded-xl bg-white p-5 shadow-sm ring-1 transition-all",
        s.card,
        href ? "hover:shadow-md hover:-translate-y-0.5" : "",
      ]
        .join(" ")}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className={`text-xs font-semibold uppercase tracking-wider ${s.label}`}>
            {label}
          </p>
          <p className={`mt-2 font-display text-3xl font-bold tracking-tight ${s.value}`}>
            {value}
            {unit ? (
              <span className="ml-1.5 text-sm font-normal text-zinc-400">{unit}</span>
            ) : null}
          </p>
          {subtitle ? (
            <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
          ) : null}
        </div>
        {icon ? (
          <div className="flex-shrink-0 rounded-lg bg-zinc-100 p-2 text-zinc-500">
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus-ring rounded-xl">
        {content}
      </Link>
    );
  }
  return content;
}
