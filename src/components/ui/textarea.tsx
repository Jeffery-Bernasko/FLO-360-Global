import { inputStyles } from "./input";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={[inputStyles, "resize-y", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
