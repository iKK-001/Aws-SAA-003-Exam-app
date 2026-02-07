'use client';

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-aws-navy/10 ${className}`}
      aria-hidden
    />
  );
}

/** 首页加载骨架 */
export function HomeSkeleton() {
  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <div className="rounded-3xl bg-white p-5 shadow-card">
        <Skeleton className="mb-4 h-5 w-24" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    </div>
  );
}

/** 练习页加载骨架 */
export function PracticeSkeleton() {
  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-24" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-32" />
      <div className="rounded-2xl bg-white p-4 shadow-card">
        <Skeleton className="mb-3 h-4 w-full" />
        <Skeleton className="mb-3 h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}

/** 百科页加载骨架 */
export function GlossarySkeleton() {
  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <Skeleton className="h-12 w-full rounded-2xl" />
      <Skeleton className="h-4 w-32" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl bg-white/80 p-4 shadow-soft">
            <div className="mb-3 flex justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-14" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
