/** Shared skeleton blocks — bg matches Day 5A spec. */
export function SkeletonBlock({ className = '' }) {
  return <div className={`skeleton ${className}`} />;
}

/** Product grid placeholder (shop, search, homepage). */
export function ProductGridSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-black/5 dark:border-white/10">
          <SkeletonBlock className="aspect-square w-full rounded-none" />
          <div className="space-y-2 p-3">
            <SkeletonBlock className="h-4 w-3/4" />
            <SkeletonBlock className="h-4 w-1/3" />
            <SkeletonBlock className="mt-2 h-9 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Order list cards (customer dashboard). */
export function OrderListSkeleton({ count = 3 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-panel space-y-3">
          <div className="flex justify-between">
            <SkeletonBlock className="h-4 w-32" />
            <SkeletonBlock className="h-5 w-20 rounded-full" />
          </div>
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-12 w-12 rounded-lg" />
            <SkeletonBlock className="h-12 w-12 rounded-lg" />
            <SkeletonBlock className="h-4 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Admin data table rows. */
export function AdminTableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div className="overflow-hidden rounded-xl border border-black/5 bg-white dark:border-white/10 dark:bg-[#1C1C1C]">
      <div className="border-b border-black/10 p-3 dark:border-white/10">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <SkeletonBlock key={i} className="h-3 flex-1" />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-black/5 p-3 last:border-0 dark:border-white/5">
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonBlock key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Product detail page (image + info columns). */
export function ProductDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,360px)_1fr]">
        <div className="mx-auto w-full max-w-[360px] lg:mx-0">
          <div className="flex gap-2">
            <div className="hidden w-12 shrink-0 flex-col gap-1.5 md:flex">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-12 w-12 rounded-md" />
              ))}
            </div>
            <SkeletonBlock className="h-[280px] w-full flex-1 rounded-xl md:h-[320px]" />
          </div>
        </div>
        <div className="space-y-4">
          <SkeletonBlock className="h-8 w-2/3" />
          <SkeletonBlock className="h-8 w-1/3" />
          <SkeletonBlock className="h-32 w-full rounded-2xl" />
          <SkeletonBlock className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}

/** Generic form / settings panel placeholder. */
export function FormPanelSkeleton({ sections = 2 }) {
  return (
    <div className="space-y-6">
      <SkeletonBlock className="h-8 w-48" />
      {Array.from({ length: sections }).map((_, i) => (
        <div key={i} className="card-panel space-y-4">
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="h-10 w-full" />
          <SkeletonBlock className="h-10 w-full" />
          <SkeletonBlock className="h-10 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/** Dashboard / admin stat cards. */
export function DashboardStatsSkeleton({ count = 4 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-brand p-5">
          <SkeletonBlock className="mb-3 h-3 w-20" />
          <SkeletonBlock className="h-8 w-16" />
          <SkeletonBlock className="mt-2 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}
