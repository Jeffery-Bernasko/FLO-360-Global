import Link from "next/link";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "approve" | "reject";
type Size = "sm" | "md" | "lg";

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-green-800 text-white shadow-sm hover:bg-green-900 active:bg-green-950 disabled:opacity-50",
  secondary:
    "bg-white text-zinc-700 shadow-sm ring-1 ring-surface-border hover:bg-zinc-50 active:bg-zinc-100 disabled:opacity-50",
  danger:
    "bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50",
  ghost:
    "text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200 disabled:opacity-50",
  approve:
    "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50",
  reject:
    "bg-white text-rose-700 shadow-sm ring-1 ring-rose-300 hover:bg-rose-50 active:bg-rose-100 disabled:opacity-50",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm gap-1.5",
  md: "px-4 py-2.5 text-sm gap-2",
  lg: "px-5 py-3 text-base gap-2",
};

type BaseProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
};

type ButtonProps = BaseProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps>;

type LinkButtonProps = BaseProps & {
  href: string;
};

function cls(variant: Variant, size: Size, className?: string) {
  return [
    "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-ring",
    variantStyles[variant],
    sizeStyles[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={cls(variant, size, className)} {...props}>
      {children}
    </button>
  );
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  href,
  children,
}: LinkButtonProps) {
  return (
    <Link href={href} className={cls(variant, size, className)}>
      {children}
    </Link>
  );
}
