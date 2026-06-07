import { Link } from 'react-router-dom';
import { useKits } from '../hooks/catalog';
import EmptyState from '../components/ui/EmptyState';
import { ProductGridSkeleton } from '../components/ui/Skeleton';
import { resolveProductImageUrl } from '../lib/productImages';

export default function KitsIndexPage() {
  const { data: kits = [], isLoading, isError } = useKits();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-extrabold">Member kits</h1>
        <p className="mt-1 text-sm text-muted">Everything your member needs — pick a kit to build your order.</p>
        <div className="mt-8">
          <ProductGridSkeleton count={4} />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <EmptyState title="Could not load kits" message="Please try again in a moment." actionLabel="Back home" actionTo="/" />
      </div>
    );
  }

  if (!kits.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <EmptyState
          title="No kits available yet"
          message="Check back soon — club leaders will share kit links when ready."
          actionLabel="Browse shop"
          actionTo="/shop"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24">
      <nav className="mb-4 text-sm text-subtle">
        <Link to="/" className="hover:text-brand-green">Home</Link>
        {' / '}
        <span>Member kits</span>
      </nav>

      <h1 className="text-2xl font-extrabold text-[#111111] dark:text-white md:text-3xl">Member kits</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Pick a kit for your club or class. Tick items you already own, then add the rest to your cart in one go.
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kits.map((kit) => (
          <li key={kit.id}>
            <Link
              to={`/kits/${kit.slug}`}
              className="flex h-full flex-col overflow-hidden rounded-2xl border border-black/8 bg-white transition hover:border-brand-green/40 hover:shadow-md dark:border-white/10 dark:bg-[#1E1E1E]"
            >
              <div className="aspect-[16/9] bg-brand-green/5 dark:bg-brand-green/10">
                {kit.image_url ? (
                  <img src={resolveProductImageUrl(kit.image_url)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-4xl">🎒</div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h2 className="font-extrabold text-[#111111] dark:text-white">{kit.name}</h2>
                {kit.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{kit.description}</p>
                )}
                <span className="mt-auto pt-3 text-sm font-bold text-brand-green">Build this kit →</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
