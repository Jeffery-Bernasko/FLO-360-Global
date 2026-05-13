export function Skeleton({
  className,
  width,
  height,
}: {
  className?: string;
  width?: string;
  height?: string;
}) {
  return (
    <div
      className={["skeleton", className].filter(Boolean).join(" ")}
      style={{ width, height }}
      aria-hidden
    />
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl bg-white ring-1 ring-surface-border">
      <div className="border-b border-surface-border bg-zinc-50/50 px-4 py-3">
        <div className="flex gap-6">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} height="12px" width={i === 0 ? "120px" : "80px"} />
          ))}
        </div>
      </div>
      <div className="divide-y divide-surface-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 px-4 py-3.5">
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton
                key={j}
                height="14px"
                width={j === 0 ? "140px" : "70px"}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MetricSkeleton() {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-surface-border">
      <Skeleton height="10px" width="80px" className="mb-3" />
      <Skeleton height="28px" width="100px" className="mb-2" />
      <Skeleton height="12px" width="120px" />
    </div>
  );
}
