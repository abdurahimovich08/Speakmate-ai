/* ===========================
   Skeleton — shimmer loading placeholders
   =========================== */

interface SkeletonProps {
  className?: string
}

function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-white/5 ${className}`}
      role="status"
      aria-label="Loading"
    />
  )
}

/** Score card placeholder with 4 bars */
export function ScoreCardSkeleton() {
  return (
    <div className="rounded-2xl bg-sm-card p-5 space-y-4">
      <Skeleton className="h-5 w-32" />
      <div className="flex items-center justify-center">
        <Skeleton className="h-24 w-24 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Error list placeholder with 3 cards */
export function ErrorListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl bg-sm-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  )
}

/** History list placeholder */
export function HistorySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl bg-sm-card p-4">
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-6 w-12" />
        </div>
      ))}
    </div>
  )
}

/** Coach dashboard placeholder */
export function CoachSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="rounded-2xl bg-sm-card p-5 space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

/** Generic inline skeleton bar */
export function InlineSkeleton({ width = 'w-20', height = 'h-4' }: { width?: string; height?: string }) {
  return <Skeleton className={`${width} ${height} inline-block`} />
}

export default Skeleton
