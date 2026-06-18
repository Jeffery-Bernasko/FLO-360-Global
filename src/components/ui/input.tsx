export const inputStyles =
  "block w-full rounded-lg border border-surface-border bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus-ring transition-colors";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={[inputStyles, className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
