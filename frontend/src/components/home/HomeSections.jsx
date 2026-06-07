import { Link } from 'react-router-dom';

export function SectionDivider() {
  return <div className="h-px bg-black/8 dark:bg-white/10" aria-hidden />;
}

export function HomeSectionSkeleton({ title }) {
  return (
    <div className="space-y-3">
      <div className="h-6 w-40 animate-pulse rounded-lg bg-[#E5E7EB] dark:bg-[#2A2A2A]" />
      <div className="flex gap-3 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-52 w-40 shrink-0 animate-pulse rounded-2xl bg-[#E5E7EB] dark:bg-[#2A2A2A]"
          />
        ))}
      </div>
      {title && <span className="sr-only">Loading {title}</span>}
    </div>
  );
}

export function PromoStrip() {
  return (
    <Link
      to="/shop"
      className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-brand-green px-4 py-2.5 text-center text-sm font-bold text-white"
    >
      Free delivery options across Ghana — shop now
    </Link>
  );
}
