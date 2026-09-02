export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-line/70 ${className}`} />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-[1.5rem] border border-line bg-card p-4">
      <Skeleton className="mb-3 h-4 w-20" />
      <Skeleton className="mb-2 h-6 w-40" />
      <Skeleton className="h-4 w-full" />
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-[1.5rem] border border-line bg-card p-5 text-sm">
      <p className="text-ink">{message}</p>
      {onRetry ? (
        <button type="button" className="btn-secondary mt-4" onClick={onRetry}>
          다시 시도
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-line bg-card p-6 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted">{body}</p>
      {action ? (
        <button type="button" className="btn-primary mt-4" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
