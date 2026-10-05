/** Placeholder for any list card (vocab or grammar) while its data loads. */
export function CardSkeleton() {
  return (
    <div className="rounded-lg p-4 animate-pulse bg-surface border border-divider">
      <div className="h-4 w-24 mb-2 bg-divider rounded" />
      <div className="h-3 w-32 mb-3 bg-divider rounded" />
      <div className="h-3 w-full bg-divider rounded" />
    </div>
  );
}
