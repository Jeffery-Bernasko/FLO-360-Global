type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumb?: string;
};

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {breadcrumb ? (
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-400">
            {breadcrumb}
          </p>
        ) : null}
        <h1 className="font-display text-2xl font-bold tracking-tight text-zinc-900">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-shrink-0 gap-2">{actions}</div> : null}
    </header>
  );
}
