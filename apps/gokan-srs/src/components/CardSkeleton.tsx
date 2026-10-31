interface CardSkeletonProps {
  /**
   * `card` (the default): a list card's placeholder (vocab or grammar). `line`: one line of text
   * inside a row already drawn (a kanji's meanings and readings beside its tile).
   */
  variant?: 'card' | 'line';
}

/** Placeholder for data still loading: a list card, or one line of a row. */
export function CardSkeleton({ variant = 'card' }: CardSkeletonProps) {
  if (variant === 'line') {
    return (
      <div data-skeleton className="animate-pulse py-1">
        <div className="h-4 w-40 max-w-full bg-divider rounded" />
      </div>
    );
  }
  return (
    <div className="rounded-md p-4 animate-pulse bg-surface border border-divider">
      <div className="h-4 w-24 mb-2 bg-divider rounded" />
      <div className="h-3 w-32 mb-3 bg-divider rounded" />
      <div className="h-3 w-full bg-divider rounded" />
    </div>
  );
}
