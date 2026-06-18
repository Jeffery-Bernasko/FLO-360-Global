import { LinkButton } from "./button";

type EmptyStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  icon?: React.ReactNode;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-white px-6 py-16 text-center ring-1 ring-surface-border">
      {icon ? (
        <div className="mb-4 rounded-xl bg-zinc-100 p-3 text-zinc-400">
          {icon}
        </div>
      ) : (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" className="text-zinc-400">
            <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M20 12H4m8-8v16" />
          </svg>
        </div>
      )}
      <h3 className="font-display text-base font-semibold text-zinc-900">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p>
      ) : null}
      {actionLabel && actionHref ? (
        <div className="mt-4">
          <LinkButton href={actionHref} size="sm">
            {actionLabel}
          </LinkButton>
        </div>
      ) : null}
    </div>
  );
}
