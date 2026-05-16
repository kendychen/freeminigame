/** Global loading fallback — shown while route segment server-renders. */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 space-y-6">
      {/* Title skeleton */}
      <div className="space-y-2">
        <div className="h-6 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-3 w-64 animate-pulse rounded-md bg-muted/60" />
      </div>
      {/* Card skeletons */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-lg border bg-card p-4">
            <div className="h-5 w-3/4 animate-pulse rounded-md bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded-md bg-muted/60" />
            <div className="h-3 w-2/3 animate-pulse rounded-md bg-muted/60" />
          </div>
        ))}
      </div>
    </div>
  );
}
