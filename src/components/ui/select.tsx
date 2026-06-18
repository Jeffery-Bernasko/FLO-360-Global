import { inputStyles } from "./input";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={[inputStyles, "cursor-pointer", className].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </select>
  );
}
