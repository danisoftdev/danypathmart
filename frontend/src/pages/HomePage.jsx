import { Link } from 'react-router-dom';
import { useCategories, useProducts } from '../hooks/catalog';
import ProductCard from '../components/product/ProductCard';
import EmptyState from '../components/ui/EmptyState';
import { ProductGridSkeleton } from '../components/ui/Skeleton';

export default function HomePage() {
  const { data: productsData, isLoading } = useProducts({ sort: 'newest', page: 1 });
  const { data: catData } = useCategories();
  const products = productsData?.data ?? [];
  const categories = (catData?.data ?? []).slice(0, 8);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 md:py-10">
      {categories.length > 0 && (
        <div className="mb-8">
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link
                key={c.id}
                to={`/shop?category=${c.slug}`}
                className="rounded-full border-2 border-brand-green px-4 py-1.5 text-sm font-semibold text-brand-green transition hover:bg-brand-green hover:text-white"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <ProductGridSkeleton count={12} />
      ) : products.length === 0 ? (
        <EmptyState
          title="No products yet"
          message="Check back soon — new items are added regularly."
          actionLabel="Browse shop"
          actionTo="/shop"
        />
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-xl font-bold text-[#111111] dark:text-white">Products</h1>
            <Link to="/shop" className="text-sm font-semibold text-brand-green hover:underline">
              View all &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
