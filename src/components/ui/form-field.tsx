type FormFieldProps = {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
  error?: string;
  hint?: string;
};

export function FormField({
  label,
  optional,
  children,
  error,
  hint,
}: FormFieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">
        {label}
        {optional ? (
          <span className="ml-1 font-normal text-zinc-400">(optional)</span>
        ) : null}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && !error ? (
        <p className="mt-1 text-xs text-zinc-400">{hint}</p>
      ) : null}
      {error ? (
        <p className="mt-1 text-xs text-rose-600" role="alert">{error}</p>
      ) : null}
    </label>
  );
}

export function FormCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "space-y-5 rounded-xl bg-white p-6 shadow-sm ring-1 ring-surface-border",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
